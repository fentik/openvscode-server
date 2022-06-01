#!/usr/bin/python3
#
# In order for the SQL auto-completion code to work, the SQL parser expects
# to see valid SQL. Since our code includes Jinja, that's not valid SQL so
# we need to render the jinja before every call to autocomplete


import sys
import jinja2

def render_jinja(query):
  def model_reference(model_name):
    return model_name

  def source_reference(source, table):
    return '.'.join([source, table])

  jinja_env = jinja2.Environment()
  jinja_env.globals['ref'] = model_reference
  jinja_env.globals['source'] = source_reference
  return jinja_env.from_string(query).render()

if __name__ == '__main__':
    query = sys.stdin.read()
    try:
      query = render_jinja(query)
    except:
      # if there's an error, return the original query; since we 
      # call render for every typed character, it's expected that
      # many of the queries we get will not be valid for some
      # period of time
      pass
    sys.stdout.write(query)
