#!/usr/bin/python3
#
# Our Theia plugin will call this file with query SQL that the user wants
# to preview, and we will build a full CTE based SQL statement to pass on to the
# backend.
#
# Additionally, we have a side channel where we pass in meta-data about what's open
# in the IDE. Included variables:
#
# FENTIK_WORKSPACE_PATH=/path/to/repo/directory

import os
import sys
from collections import deque
from pathlib import Path

import jinja2
import networkx

SENTINEL_TARGET = "__fentik__query_with_cte"


def file_contents(path):
    with open(path, 'r') as f:
        return f.read()


def sanitize(query):
    # strip leading and trailing whitespace
    # remove any trailing semicolons
    query = query.strip()
    while query[-1:] == ';':
        query = query[:-1]
    return query


def render_jinja(model_content):
    def source_reference(source, table):
        # preserve source Jinja references
        return "{{source('%s', '%s')}}" % (source, table)

    model_depends_on = []

    def model_reference(model_name):
        model_depends_on.append(model_name)
        return model_name

    jinja_env = jinja2.Environment()
    jinja_env.globals['ref'] = model_reference
    jinja_env.globals['source'] = source_reference
    try:
        template = jinja_env.from_string(model_content)
        model_content = template.render()
    except Exception:
        # return original Jinja template if there is an error processing
        # a template file, otherwise the entire process will return an
        # error
        pass
    return {"content": model_content, "depends_on": model_depends_on}


def build_cte(query, models_path):
    models = {SENTINEL_TARGET: render_jinja(query)}

    for path in Path(models_path).rglob('*.sql'):
        model_name = path.name[:-4]
        models[model_name] = render_jinja(sanitize(file_contents(path)))

    dag = networkx.DiGraph()
    nodes = deque([SENTINEL_TARGET])
    while nodes:
        node = nodes.popleft()
        dag.add_node(node)
        deps = []
        if node in models:
            deps = models[node]['depends_on']
        nodes.extend(deps)
        for dep in deps:
            dag.add_node(dep)
            dag.add_edge(dep, node)

    inputs = list(networkx.topological_sort(dag))

    if len(inputs) == 1:
        return models[inputs[0]]['content']

    last = inputs.pop()

    def as_cte(model_name, model):
        return model_name + " as (\n" + model['content'] + "\n)"

    # XXX(sergei): if we cannot resolve a model locally, we can bubble up the
    # the error right away, but then we will need to have a consistent error
    # path in two places; for now, elide the non-existant model from the CTE
    # but keep the reference letting the Flink parser blow up instead
    ctes = []
    for m in inputs:
        if m in models:
            ctes.append(as_cte(m, models[m]))

    return "WITH " + ",".join(ctes) + "\n" + models[last]['content']


if __name__ == '__main__':
    workspace_path = os.environ['FENTIK_WORKSPACE_PATH']
    models_path = None
    for path in Path(workspace_path).rglob('fentik-config.yml'):
        models_path = os.path.dirname(path) + '/models'
        break

    query = sys.stdin.read()
    query = build_cte(sanitize(query), models_path)
    sys.stdout.write(query)
