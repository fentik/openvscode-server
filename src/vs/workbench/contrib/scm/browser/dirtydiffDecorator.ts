/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';

import 'vs/css!./media/dirtydiffDecorator';
import { ThrottledDelayer } from 'vs/base/common/async';
import { IDisposable, dispose, toDisposable, Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import * as ext from 'vs/workbench/common/contributions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IResolvedTextEditorModel, ITextModelService } from 'vs/editor/common/services/resolverService';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorker';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { URI } from 'vs/base/common/uri';
import { ISCMService, ISCMRepository } from 'vs/workbench/contrib/scm/common/scm';
import { ModelDecorationOptions } from 'vs/editor/common/model/textModel';
import { IColorTheme, themeColorFromId, IThemeService } from 'vs/platform/theme/common/themeService';
import { editorErrorForeground, registerColor, transparent } from 'vs/platform/theme/common/colorRegistry';
import { ICodeEditor, IEditorMouseEvent, isCodeEditor, MouseTargetType } from 'vs/editor/browser/editorBrowser';
import { registerEditorAction, registerEditorContribution, ServicesAccessor, EditorAction, EditorContributionInstantiation } from 'vs/editor/browser/editorExtensions';
import { PeekViewWidget, getOuterEditor, peekViewBorder, peekViewTitleBackground, peekViewTitleForeground, peekViewTitleInfoForeground } from 'vs/editor/contrib/peekView/browser/peekView';
import { IContextKeyService, IContextKey, ContextKeyExpr, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { rot } from 'vs/base/common/numbers';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { EmbeddedDiffEditorWidget } from 'vs/editor/browser/widget/embeddedCodeEditorWidget';
import { IDiffEditorOptions, EditorOption } from 'vs/editor/common/config/editorOptions';
import { Action, IAction, ActionRunner } from 'vs/base/common/actions';
import { IActionBarOptions } from 'vs/base/browser/ui/actionbar/actionbar';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { basename } from 'vs/base/common/resources';
import { MenuId, IMenuService, IMenu, MenuItemAction, MenuRegistry } from 'vs/platform/actions/common/actions';
import { createAndFillInActionBarActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IEditorModel, ScrollType, IEditorContribution, IDiffEditorModel } from 'vs/editor/common/editorCommon';
import { OverviewRulerLane, ITextModel, IModelDecorationOptions, MinimapPosition } from 'vs/editor/common/model';
import { sortedDiff } from 'vs/base/common/arrays';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { ISplice } from 'vs/base/common/sequence';
import { createStyleSheet } from 'vs/base/browser/dom';
import { EncodingMode, ITextFileEditorModel, IResolvedTextFileEditorModel, ITextFileService, isTextFileEditorModel } from 'vs/workbench/services/textfile/common/textfiles';
import { gotoNextLocation, gotoPreviousLocation } from 'vs/platform/theme/common/iconRegistry';
import { Codicon } from 'vs/base/common/codicons';
import { ThemeIcon } from 'vs/base/common/themables';
import { onUnexpectedError } from 'vs/base/common/errors';
import { TextCompareEditorActiveContext } from 'vs/workbench/common/contextkeys';
import { IProgressService, ProgressLocation } from 'vs/platform/progress/common/progress';
import { IChange } from 'vs/editor/common/diff/smartLinesDiffComputer';
import { Color } from 'vs/base/common/color';
import { ResourceMap } from 'vs/base/common/map';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { DEFAULT_EDITOR_ASSOCIATION } from 'vs/workbench/common/editor';
import { FILE_EDITOR_INPUT_ID } from 'vs/workbench/contrib/files/common/files';
import { AudioCue, IAudioCueService } from 'vs/platform/audioCues/browser/audioCueService';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IQuickDiffService } from 'vs/workbench/contrib/scm/common/quickDiff';

class DiffActionRunner extends ActionRunner {

	override runAction(action: IAction, context: any): Promise<any> {
		if (action instanceof MenuItemAction) {
			return action.run(...context);
		}

		return super.runAction(action, context);
	}
}

export interface IModelRegistry {
	getModel(editorModel: IEditorModel): DirtyDiffModel | undefined;
}

export const isDirtyDiffVisible = new RawContextKey<boolean>('dirtyDiffVisible', false);

function getChangeHeight(change: IChange): number {
	const modified = change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
	const original = change.originalEndLineNumber - change.originalStartLineNumber + 1;

	if (change.originalEndLineNumber === 0) {
		return modified;
	} else if (change.modifiedEndLineNumber === 0) {
		return original;
	} else {
		return modified + original;
	}
}

function getModifiedEndLineNumber(change: IChange): number {
	if (change.modifiedEndLineNumber === 0) {
		return change.modifiedStartLineNumber === 0 ? 1 : change.modifiedStartLineNumber;
	} else {
		return change.modifiedEndLineNumber;
	}
}

function lineIntersectsChange(lineNumber: number, change: IChange): boolean {
	// deletion at the beginning of the file
	if (lineNumber === 1 && change.modifiedStartLineNumber === 0 && change.modifiedEndLineNumber === 0) {
		return true;
	}

	return lineNumber >= change.modifiedStartLineNumber && lineNumber <= (change.modifiedEndLineNumber || change.modifiedStartLineNumber);
}

class UIEditorAction extends Action {

	private editor: ICodeEditor;
	private action: EditorAction;
	private instantiationService: IInstantiationService;

	constructor(
		editor: ICodeEditor,
		action: EditorAction,
		cssClass: string,
		@IKeybindingService keybindingService: IKeybindingService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		const keybinding = keybindingService.lookupKeybinding(action.id);
		const label = action.label + (keybinding ? ` (${keybinding.getLabel()})` : '');

		super(action.id, label, cssClass);

		this.instantiationService = instantiationService;
		this.action = action;
		this.editor = editor;
	}

	override run(): Promise<any> {
		return Promise.resolve(this.instantiationService.invokeFunction(accessor => this.action.run(accessor, this.editor, null)));
	}
}

enum ChangeType {
	Modify,
	Add,
	Delete
}

function getChangeType(change: IChange): ChangeType {
	if (change.originalEndLineNumber === 0) {
		return ChangeType.Add;
	} else if (change.modifiedEndLineNumber === 0) {
		return ChangeType.Delete;
	} else {
		return ChangeType.Modify;
	}
}

function getChangeTypeColor(theme: IColorTheme, changeType: ChangeType): Color | undefined {
	switch (changeType) {
		case ChangeType.Modify: return theme.getColor(editorGutterModifiedBackground);
		case ChangeType.Add: return theme.getColor(editorGutterAddedBackground);
		case ChangeType.Delete: return theme.getColor(editorGutterDeletedBackground);
	}
}

function getOuterEditorFromDiffEditor(accessor: ServicesAccessor): ICodeEditor | null {
	const diffEditors = accessor.get(ICodeEditorService).listDiffEditors();

	for (const diffEditor of diffEditors) {
		if (diffEditor.hasTextFocus() && diffEditor instanceof EmbeddedDiffEditorWidget) {
			return diffEditor.getParentEditor();
		}
	}

	return getOuterEditor(accessor);
}

class DirtyDiffWidget extends PeekViewWidget {

	private diffEditor!: EmbeddedDiffEditorWidget;
	private title: string;
	private menu: IMenu;
	private index: number = 0;
	private change: IChange | undefined;
	private height: number | undefined = undefined;

	constructor(
		editor: ICodeEditor,
		private model: DirtyDiffModel,
		@IThemeService private readonly themeService: IThemeService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IMenuService menuService: IMenuService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super(editor, { isResizeable: true, frameWidth: 1, keepEditorSelection: true }, instantiationService);

		this._disposables.add(themeService.onDidColorThemeChange(this._applyTheme, this));
		this._applyTheme(themeService.getColorTheme());

		if (this.model.original) {
			contextKeyService = contextKeyService.createOverlay([['originalResourceScheme', this.model.original.uri.scheme]]);
		}

		this.menu = menuService.createMenu(MenuId.SCMChangeContext, contextKeyService);
		this._disposables.add(this.menu);

		this.create();
		if (editor.hasModel()) {
			this.title = basename(editor.getModel().uri);
		} else {
			this.title = '';
		}
		this.setTitle(this.title);

		this._disposables.add(model.onDidChange(this.renderTitle, this));
	}

	showChange(index: number): void {
		const change = this.model.changes[index];
		this.index = index;
		this.change = change;

		const originalModel = this.model.original;

		if (!originalModel) {
			return;
		}

		const onFirstDiffUpdate = Event.once(this.diffEditor.onDidUpdateDiff);

		// TODO@joao TODO@alex need this setTimeout probably because the
		// non-side-by-side diff still hasn't created the view zones
		onFirstDiffUpdate(() => setTimeout(() => this.revealChange(change), 0));

		this.diffEditor.setModel(this.model as IDiffEditorModel);

		const position = new Position(getModifiedEndLineNumber(change), 1);

		const lineHeight = this.editor.getOption(EditorOption.lineHeight);
		const editorHeight = this.editor.getLayoutInfo().height;
		const editorHeightInLines = Math.floor(editorHeight / lineHeight);
		const height = Math.min(getChangeHeight(change) + /* padding */ 8, Math.floor(editorHeightInLines / 3));

		this.renderTitle();

		const changeType = getChangeType(change);
		const changeTypeColor = getChangeTypeColor(this.themeService.getColorTheme(), changeType);
		this.style({ frameColor: changeTypeColor, arrowColor: changeTypeColor });

		this._actionbarWidget!.context = [this.model.modified!.uri, this.model.changes, index];
		this.show(position, height);
		this.editor.focus();
	}

	private renderTitle(): void {
		const detail = this.model.changes.length > 1
			? nls.localize('changes', "{0} of {1} changes", this.index + 1, this.model.changes.length)
			: nls.localize('change', "{0} of {1} change", this.index + 1, this.model.changes.length);

		this.setTitle(this.title, detail);
	}

	protected override _fillHead(container: HTMLElement): void {
		super._fillHead(container, true);

		const previous = this.instantiationService.createInstance(UIEditorAction, this.editor, new ShowPreviousChangeAction(this.editor), ThemeIcon.asClassName(gotoPreviousLocation));
		const next = this.instantiationService.createInstance(UIEditorAction, this.editor, new ShowNextChangeAction(this.editor), ThemeIcon.asClassName(gotoNextLocation));

		this._disposables.add(previous);
		this._disposables.add(next);

		const actions: IAction[] = [];
		createAndFillInActionBarActions(this.menu, { shouldForwardArgs: true }, actions);
		this._actionbarWidget!.push(actions.reverse(), { label: false, icon: true });
		this._actionbarWidget!.push([next, previous], { label: false, icon: true });
		this._actionbarWidget!.push(new Action('peekview.close', nls.localize('label.close', "Close"), ThemeIcon.asClassName(Codicon.close), true, () => this.dispose()), { label: false, icon: true });
	}

	protected override _getActionBarOptions(): IActionBarOptions {
		const actionRunner = new DiffActionRunner();

		// close widget on successful action
		actionRunner.onDidRun(e => {
			if (!(e.action instanceof UIEditorAction) && !e.error) {
				this.dispose();
			}
		});

		return {
			...super._getActionBarOptions(),
			actionRunner
		};
	}

	protected _fillBody(container: HTMLElement): void {
		const options: IDiffEditorOptions = {
			scrollBeyondLastLine: true,
			scrollbar: {
				verticalScrollbarSize: 14,
				horizontal: 'auto',
				useShadows: true,
				verticalHasArrows: false,
				horizontalHasArrows: false
			},
			overviewRulerLanes: 2,
			fixedOverflowWidgets: true,
			minimap: { enabled: false },
			renderSideBySide: false,
			readOnly: false,
			renderIndicators: false,
			diffAlgorithm: 'smart',
		};

		this.diffEditor = this.instantiationService.createInstance(EmbeddedDiffEditorWidget, container, options, this.editor);
		this._disposables.add(this.diffEditor);
	}

	protected override _onWidth(width: number): void {
		if (typeof this.height === 'undefined') {
			return;
		}

		this.diffEditor.layout({ height: this.height, width });
	}

	protected override _doLayoutBody(height: number, width: number): void {
		super._doLayoutBody(height, width);
		this.diffEditor.layout({ height, width });

		if (typeof this.height === 'undefined' && this.change) {
			this.revealChange(this.change);
		}

		this.height = height;
	}

	private revealChange(change: IChange): void {
		let start: number, end: number;

		if (change.modifiedEndLineNumber === 0) { // deletion
			start = change.modifiedStartLineNumber;
			end = change.modifiedStartLineNumber + 1;
		} else if (change.originalEndLineNumber > 0) { // modification
			start = change.modifiedStartLineNumber - 1;
			end = change.modifiedEndLineNumber + 1;
		} else { // insertion
			start = change.modifiedStartLineNumber;
			end = change.modifiedEndLineNumber;
		}

		this.diffEditor.revealLinesInCenter(start, end, ScrollType.Immediate);
	}

	private _applyTheme(theme: IColorTheme) {
		const borderColor = theme.getColor(peekViewBorder) || Color.transparent;
		this.style({
			arrowColor: borderColor,
			frameColor: borderColor,
			headerBackgroundColor: theme.getColor(peekViewTitleBackground) || Color.transparent,
			primaryHeadingColor: theme.getColor(peekViewTitleForeground),
			secondaryHeadingColor: theme.getColor(peekViewTitleInfoForeground)
		});
	}

	protected override revealRange(range: Range) {
		this.editor.revealLineInCenterIfOutsideViewport(range.endLineNumber, ScrollType.Smooth);
	}

	hasFocus(): boolean {
		return this.diffEditor.hasTextFocus();
	}
}

export class ShowPreviousChangeAction extends EditorAction {

	constructor(private readonly outerEditor?: ICodeEditor) {
		super({
			id: 'editor.action.dirtydiff.previous',
			label: nls.localize('show previous change', "Show Previous Change"),
			alias: 'Show Previous Change',
			precondition: TextCompareEditorActiveContext.toNegated(),
			kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: KeyMod.Shift | KeyMod.Alt | KeyCode.F3, weight: KeybindingWeight.EditorContrib }
		});
	}

	run(accessor: ServicesAccessor): void {
		const outerEditor = this.outerEditor ?? getOuterEditorFromDiffEditor(accessor);

		if (!outerEditor) {
			return;
		}

		const controller = DirtyDiffController.get(outerEditor);

		if (!controller) {
			return;
		}

		if (!controller.canNavigate()) {
			return;
		}

		controller.previous();
	}
}
registerEditorAction(ShowPreviousChangeAction);

export class ShowNextChangeAction extends EditorAction {

	constructor(private readonly outerEditor?: ICodeEditor) {
		super({
			id: 'editor.action.dirtydiff.next',
			label: nls.localize('show next change', "Show Next Change"),
			alias: 'Show Next Change',
			precondition: TextCompareEditorActiveContext.toNegated(),
			kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: KeyMod.Alt | KeyCode.F3, weight: KeybindingWeight.EditorContrib }
		});
	}

	run(accessor: ServicesAccessor): void {
		const outerEditor = this.outerEditor ?? getOuterEditorFromDiffEditor(accessor);

		if (!outerEditor) {
			return;
		}

		const controller = DirtyDiffController.get(outerEditor);

		if (!controller) {
			return;
		}

		if (!controller.canNavigate()) {
			return;
		}

		controller.next();
	}
}
registerEditorAction(ShowNextChangeAction);

// Go to menu
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
	group: '7_change_nav',
	command: {
		id: 'editor.action.dirtydiff.next',
		title: nls.localize({ key: 'miGotoNextChange', comment: ['&& denotes a mnemonic'] }, "Next &&Change")
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
	group: '7_change_nav',
	command: {
		id: 'editor.action.dirtydiff.previous',
		title: nls.localize({ key: 'miGotoPreviousChange', comment: ['&& denotes a mnemonic'] }, "Previous &&Change")
	},
	order: 2
});

export class GotoPreviousChangeAction extends EditorAction {

	constructor() {
		super({
			id: 'workbench.action.editor.previousChange',
			label: nls.localize('move to previous change', "Go to Previous Change"),
			alias: 'Go to Previous Change',
			precondition: TextCompareEditorActiveContext.toNegated(),
			kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: KeyMod.Shift | KeyMod.Alt | KeyCode.F5, weight: KeybindingWeight.EditorContrib }
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const outerEditor = getOuterEditorFromDiffEditor(accessor);
		const audioCueService = accessor.get(IAudioCueService);
		const accessibilityService = accessor.get(IAccessibilityService);
		const codeEditorService = accessor.get(ICodeEditorService);

		if (!outerEditor || !outerEditor.hasModel()) {
			return;
		}

		const controller = DirtyDiffController.get(outerEditor);

		if (!controller || !controller.modelRegistry) {
			return;
		}

		const lineNumber = outerEditor.getPosition().lineNumber;
		const model = controller.modelRegistry.getModel(outerEditor.getModel());
		if (!model || model.changes.length === 0) {
			return;
		}

		const index = model.findPreviousClosestChange(lineNumber, false);
		const change = model.changes[index];
		await playAudioCueForChange(change, audioCueService);
		// The audio cue can take up to a second to load. Give it a chance to play before we read the line content
		await setTimeout(() => setPositionAndSelection(change, outerEditor, accessibilityService, codeEditorService), 500);
	}
}
registerEditorAction(GotoPreviousChangeAction);

export class GotoNextChangeAction extends EditorAction {

	constructor() {
		super({
			id: 'workbench.action.editor.nextChange',
			label: nls.localize('move to next change', "Go to Next Change"),
			alias: 'Go to Next Change',
			precondition: TextCompareEditorActiveContext.toNegated(),
			kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: KeyMod.Alt | KeyCode.F5, weight: KeybindingWeight.EditorContrib }
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const audioCueService = accessor.get(IAudioCueService);
		const outerEditor = getOuterEditorFromDiffEditor(accessor);
		const accessibilityService = accessor.get(IAccessibilityService);
		const codeEditorService = accessor.get(ICodeEditorService);

		if (!outerEditor || !outerEditor.hasModel()) {
			return;
		}

		const controller = DirtyDiffController.get(outerEditor);

		if (!controller || !controller.modelRegistry) {
			return;
		}

		const lineNumber = outerEditor.getPosition().lineNumber;
		const model = controller.modelRegistry.getModel(outerEditor.getModel());

		if (!model || model.changes.length === 0) {
			return;
		}

		const index = model.findNextClosestChange(lineNumber, false);
		const change = model.changes[index];
		await playAudioCueForChange(change, audioCueService);
		// The audio cue can take up to a second to load. Give it a chance to play before we read the line content
		await setTimeout(() => setPositionAndSelection(change, outerEditor, accessibilityService, codeEditorService), 500);
	}
}

function setPositionAndSelection(change: IChange, editor: ICodeEditor, accessibilityService: IAccessibilityService, codeEditorService: ICodeEditorService) {
	const position = new Position(change.modifiedStartLineNumber, 1);
	editor.setPosition(position);
	editor.revealPositionInCenter(position);
	if (accessibilityService.isScreenReaderOptimized()) {
		editor.setSelection({ startLineNumber: change.modifiedStartLineNumber, startColumn: 0, endLineNumber: change.modifiedStartLineNumber, endColumn: Number.MAX_VALUE });
		codeEditorService.getActiveCodeEditor()?.writeScreenReaderContent('diff-navigation');
	}
}

async function playAudioCueForChange(change: IChange, audioCueService: IAudioCueService) {
	const changeType = getChangeType(change);
	switch (changeType) {
		case ChangeType.Add:
			audioCueService.playAudioCue(AudioCue.diffLineInserted, true);
		case ChangeType.Delete:
			audioCueService.playAudioCue(AudioCue.diffLineDeleted, true);
		case ChangeType.Modify:
			audioCueService.playAudioCue(AudioCue.diffLineModified, true);
	}
}

registerEditorAction(GotoNextChangeAction);

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'closeDirtyDiff',
	weight: KeybindingWeight.EditorContrib + 50,
	primary: KeyCode.Escape,
	secondary: [KeyMod.Shift | KeyCode.Escape],
	when: ContextKeyExpr.and(isDirtyDiffVisible),
	handler: (accessor: ServicesAccessor) => {
		const outerEditor = getOuterEditorFromDiffEditor(accessor);

		if (!outerEditor) {
			return;
		}

		const controller = DirtyDiffController.get(outerEditor);

		if (!controller) {
			return;
		}

		controller.close();
	}
});

export class DirtyDiffController extends Disposable implements IEditorContribution {

	public static readonly ID = 'editor.contrib.dirtydiff';

	static get(editor: ICodeEditor): DirtyDiffController | null {
		return editor.getContribution<DirtyDiffController>(DirtyDiffController.ID);
	}

	modelRegistry: IModelRegistry | null = null;

	private model: DirtyDiffModel | null = null;
	private widget: DirtyDiffWidget | null = null;
	private currentIndex: number = -1;
	private readonly isDirtyDiffVisible!: IContextKey<boolean>;
	private session: IDisposable = Disposable.None;
	private mouseDownInfo: { lineNumber: number } | null = null;
	private enabled = false;
	private gutterActionDisposables = new DisposableStore();
	private stylesheet: HTMLStyleElement;

	constructor(
		private editor: ICodeEditor,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();
		this.enabled = !contextKeyService.getContextKeyValue('isInDiffEditor');
		this.stylesheet = createStyleSheet();
		this._register(toDisposable(() => this.stylesheet.remove()));

		if (this.enabled) {
			this.isDirtyDiffVisible = isDirtyDiffVisible.bindTo(contextKeyService);
			this._register(editor.onDidChangeModel(() => this.close()));

			const onDidChangeGutterAction = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('scm.diffDecorationsGutterAction'));
			this._register(onDidChangeGutterAction(this.onDidChangeGutterAction, this));
			this.onDidChangeGutterAction();
		}
	}

	private onDidChangeGutterAction(): void {
		const gutterAction = this.configurationService.getValue<'diff' | 'none'>('scm.diffDecorationsGutterAction');

		this.gutterActionDisposables.dispose();
		this.gutterActionDisposables = new DisposableStore();

		if (gutterAction === 'diff') {
			this.gutterActionDisposables.add(this.editor.onMouseDown(e => this.onEditorMouseDown(e)));
			this.gutterActionDisposables.add(this.editor.onMouseUp(e => this.onEditorMouseUp(e)));
			this.stylesheet.textContent = `
				.monaco-editor .dirty-diff-glyph {
					cursor: pointer;
				}

				.monaco-editor .margin-view-overlays .dirty-diff-glyph:hover::before {
					height: 100%;
					width: 6px;
					left: -6px;
				}

				.monaco-editor .margin-view-overlays .dirty-diff-deleted:hover::after {
					bottom: 0;
					border-top-width: 0;
					border-bottom-width: 0;
				}
			`;
		} else {
			this.stylesheet.textContent = ``;
		}
	}

	canNavigate(): boolean {
		return this.currentIndex === -1 || (!!this.model && this.model.changes.length > 1);
	}

	next(lineNumber?: number): void {
		if (!this.assertWidget()) {
			return;
		}
		if (!this.widget || !this.model) {
			return;
		}

		if (this.editor.hasModel() && (typeof lineNumber === 'number' || this.currentIndex === -1)) {
			this.currentIndex = this.model.findNextClosestChange(typeof lineNumber === 'number' ? lineNumber : this.editor.getPosition().lineNumber);
		} else {
			this.currentIndex = rot(this.currentIndex + 1, this.model.changes.length);
		}

		this.widget.showChange(this.currentIndex);
	}

	previous(lineNumber?: number): void {
		if (!this.assertWidget()) {
			return;
		}
		if (!this.widget || !this.model) {
			return;
		}

		if (this.editor.hasModel() && (typeof lineNumber === 'number' || this.currentIndex === -1)) {
			this.currentIndex = this.model.findPreviousClosestChange(typeof lineNumber === 'number' ? lineNumber : this.editor.getPosition().lineNumber);
		} else {
			this.currentIndex = rot(this.currentIndex - 1, this.model.changes.length);
		}

		this.widget.showChange(this.currentIndex);
	}

	close(): void {
		this.session.dispose();
		this.session = Disposable.None;
	}

	private assertWidget(): boolean {
		if (!this.enabled) {
			return false;
		}

		if (this.widget) {
			if (!this.model || this.model.changes.length === 0) {
				this.close();
				return false;
			}

			return true;
		}

		if (!this.modelRegistry) {
			return false;
		}

		const editorModel = this.editor.getModel();

		if (!editorModel) {
			return false;
		}

		const model = this.modelRegistry.getModel(editorModel);

		if (!model) {
			return false;
		}

		if (model.changes.length === 0) {
			return false;
		}

		this.currentIndex = -1;
		this.model = model;
		this.widget = this.instantiationService.createInstance(DirtyDiffWidget, this.editor, model);
		this.isDirtyDiffVisible.set(true);

		const disposables = new DisposableStore();
		disposables.add(Event.once(this.widget.onDidClose)(this.close, this));
		Event.chain(model.onDidChange)
			.filter(e => e.diff.length > 0)
			.map(e => e.diff)
			.event(this.onDidModelChange, this, disposables);

		disposables.add(this.widget);
		disposables.add(toDisposable(() => {
			this.model = null;
			this.widget = null;
			this.currentIndex = -1;
			this.isDirtyDiffVisible.set(false);
			this.editor.focus();
		}));

		this.session = disposables;
		return true;
	}

	private onDidModelChange(splices: ISplice<IChange>[]): void {
		if (!this.model || !this.widget || this.widget.hasFocus()) {
			return;
		}

		for (const splice of splices) {
			if (splice.start <= this.currentIndex) {
				if (this.currentIndex < splice.start + splice.deleteCount) {
					this.currentIndex = -1;
					this.next();
				} else {
					this.currentIndex = rot(this.currentIndex + splice.toInsert.length - splice.deleteCount - 1, this.model.changes.length);
					this.next();
				}
			}
		}
	}

	private onEditorMouseDown(e: IEditorMouseEvent): void {
		this.mouseDownInfo = null;

		const range = e.target.range;

		if (!range) {
			return;
		}

		if (!e.event.leftButton) {
			return;
		}

		if (e.target.type !== MouseTargetType.GUTTER_LINE_DECORATIONS) {
			return;
		}
		if (!e.target.element) {
			return;
		}
		if (e.target.element.className.indexOf('dirty-diff-glyph') < 0) {
			return;
		}

		const data = e.target.detail;
		const offsetLeftInGutter = (e.target.element as HTMLElement).offsetLeft;
		const gutterOffsetX = data.offsetX - offsetLeftInGutter;

		// TODO@joao TODO@alex TODO@martin this is such that we don't collide with folding
		if (gutterOffsetX < -3 || gutterOffsetX > 6) { // dirty diff decoration on hover is 9px wide
			return;
		}

		this.mouseDownInfo = { lineNumber: range.startLineNumber };
	}

	private onEditorMouseUp(e: IEditorMouseEvent): void {
		if (!this.mouseDownInfo) {
			return;
		}

		const { lineNumber } = this.mouseDownInfo;
		this.mouseDownInfo = null;

		const range = e.target.range;

		if (!range || range.startLineNumber !== lineNumber) {
			return;
		}

		if (e.target.type !== MouseTargetType.GUTTER_LINE_DECORATIONS) {
			return;
		}

		if (!this.modelRegistry) {
			return;
		}

		const editorModel = this.editor.getModel();

		if (!editorModel) {
			return;
		}

		const model = this.modelRegistry.getModel(editorModel);

		if (!model) {
			return;
		}

		const index = model.changes.findIndex(change => lineIntersectsChange(lineNumber, change));

		if (index < 0) {
			return;
		}

		if (index === this.currentIndex) {
			this.close();
		} else {
			this.next(lineNumber);
		}
	}

	getChanges(): IChange[] {
		if (!this.modelRegistry) {
			return [];
		}
		if (!this.editor.hasModel()) {
			return [];
		}

		const model = this.modelRegistry.getModel(this.editor.getModel());

		if (!model) {
			return [];
		}

		return model.changes;
	}

	override dispose(): void {
		this.gutterActionDisposables.dispose();
		super.dispose();
	}
}

const editorGutterModifiedBackground = registerColor('editorGutter.modifiedBackground', {
	dark: '#1B81A8',
	light: '#2090D3',
	hcDark: '#1B81A8',
	hcLight: '#2090D3'
}, nls.localize('editorGutterModifiedBackground', "Editor gutter background color for lines that are modified."));

const editorGutterAddedBackground = registerColor('editorGutter.addedBackground', {
	dark: '#487E02',
	light: '#48985D',
	hcDark: '#487E02',
	hcLight: '#48985D'
}, nls.localize('editorGutterAddedBackground', "Editor gutter background color for lines that are added."));

const editorGutterDeletedBackground = registerColor('editorGutter.deletedBackground', {
	dark: editorErrorForeground,
	light: editorErrorForeground,
	hcDark: editorErrorForeground,
	hcLight: editorErrorForeground
}, nls.localize('editorGutterDeletedBackground', "Editor gutter background color for lines that are deleted."));

const minimapGutterModifiedBackground = registerColor('minimapGutter.modifiedBackground', {
	dark: editorGutterModifiedBackground,
	light: editorGutterModifiedBackground,
	hcDark: editorGutterModifiedBackground,
	hcLight: editorGutterModifiedBackground
}, nls.localize('minimapGutterModifiedBackground', "Minimap gutter background color for lines that are modified."));

const minimapGutterAddedBackground = registerColor('minimapGutter.addedBackground', {
	dark: editorGutterAddedBackground,
	light: editorGutterAddedBackground,
	hcDark: editorGutterAddedBackground,
	hcLight: editorGutterAddedBackground
}, nls.localize('minimapGutterAddedBackground', "Minimap gutter background color for lines that are added."));

const minimapGutterDeletedBackground = registerColor('minimapGutter.deletedBackground', {
	dark: editorGutterDeletedBackground,
	light: editorGutterDeletedBackground,
	hcDark: editorGutterDeletedBackground,
	hcLight: editorGutterDeletedBackground
}, nls.localize('minimapGutterDeletedBackground', "Minimap gutter background color for lines that are deleted."));

const overviewRulerModifiedForeground = registerColor('editorOverviewRuler.modifiedForeground', { dark: transparent(editorGutterModifiedBackground, 0.6), light: transparent(editorGutterModifiedBackground, 0.6), hcDark: transparent(editorGutterModifiedBackground, 0.6), hcLight: transparent(editorGutterModifiedBackground, 0.6) }, nls.localize('overviewRulerModifiedForeground', 'Overview ruler marker color for modified content.'));
const overviewRulerAddedForeground = registerColor('editorOverviewRuler.addedForeground', { dark: transparent(editorGutterAddedBackground, 0.6), light: transparent(editorGutterAddedBackground, 0.6), hcDark: transparent(editorGutterAddedBackground, 0.6), hcLight: transparent(editorGutterAddedBackground, 0.6) }, nls.localize('overviewRulerAddedForeground', 'Overview ruler marker color for added content.'));
const overviewRulerDeletedForeground = registerColor('editorOverviewRuler.deletedForeground', { dark: transparent(editorGutterDeletedBackground, 0.6), light: transparent(editorGutterDeletedBackground, 0.6), hcDark: transparent(editorGutterDeletedBackground, 0.6), hcLight: transparent(editorGutterDeletedBackground, 0.6) }, nls.localize('overviewRulerDeletedForeground', 'Overview ruler marker color for deleted content.'));

class DirtyDiffDecorator extends Disposable {

	static createDecoration(className: string, options: { gutter: boolean; overview: { active: boolean; color: string }; minimap: { active: boolean; color: string }; isWholeLine: boolean }): ModelDecorationOptions {
		const decorationOptions: IModelDecorationOptions = {
			description: 'dirty-diff-decoration',
			isWholeLine: options.isWholeLine,
		};

		if (options.gutter) {
			decorationOptions.linesDecorationsClassName = `dirty-diff-glyph ${className}`;
		}

		if (options.overview.active) {
			decorationOptions.overviewRuler = {
				color: themeColorFromId(options.overview.color),
				position: OverviewRulerLane.Left
			};
		}

		if (options.minimap.active) {
			decorationOptions.minimap = {
				color: themeColorFromId(options.minimap.color),
				position: MinimapPosition.Gutter
			};
		}

		return ModelDecorationOptions.createDynamic(decorationOptions);
	}

	private addedOptions: ModelDecorationOptions;
	private addedPatternOptions: ModelDecorationOptions;
	private modifiedOptions: ModelDecorationOptions;
	private modifiedPatternOptions: ModelDecorationOptions;
	private deletedOptions: ModelDecorationOptions;
	private decorations: string[] = [];
	private editorModel: ITextModel | null;

	constructor(
		editorModel: ITextModel,
		private model: DirtyDiffModel,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
		this.editorModel = editorModel;

		const decorations = configurationService.getValue<string>('scm.diffDecorations');
		const gutter = decorations === 'all' || decorations === 'gutter';
		const overview = decorations === 'all' || decorations === 'overview';
		const minimap = decorations === 'all' || decorations === 'minimap';

		this.addedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-added', {
			gutter,
			overview: { active: overview, color: overviewRulerAddedForeground },
			minimap: { active: minimap, color: minimapGutterAddedBackground },
			isWholeLine: true
		});
		this.addedPatternOptions = DirtyDiffDecorator.createDecoration('dirty-diff-added-pattern', {
			gutter,
			overview: { active: overview, color: overviewRulerAddedForeground },
			minimap: { active: minimap, color: minimapGutterAddedBackground },
			isWholeLine: true
		});
		this.modifiedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-modified', {
			gutter,
			overview: { active: overview, color: overviewRulerModifiedForeground },
			minimap: { active: minimap, color: minimapGutterModifiedBackground },
			isWholeLine: true
		});
		this.modifiedPatternOptions = DirtyDiffDecorator.createDecoration('dirty-diff-modified-pattern', {
			gutter,
			overview: { active: overview, color: overviewRulerModifiedForeground },
			minimap: { active: minimap, color: minimapGutterModifiedBackground },
			isWholeLine: true
		});
		this.deletedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-deleted', {
			gutter,
			overview: { active: overview, color: overviewRulerDeletedForeground },
			minimap: { active: minimap, color: minimapGutterDeletedBackground },
			isWholeLine: false
		});

		this._register(configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('scm.diffDecorationsGutterPattern')) {
				this.onDidChange();
			}
		}));

		this._register(model.onDidChange(this.onDidChange, this));
	}

	private onDidChange(): void {
		if (!this.editorModel) {
			return;
		}

		const pattern = this.configurationService.getValue<{ added: boolean; modified: boolean }>('scm.diffDecorationsGutterPattern');
		const decorations = this.model.changes.map((change) => {
			const changeType = getChangeType(change);
			const startLineNumber = change.modifiedStartLineNumber;
			const endLineNumber = change.modifiedEndLineNumber || startLineNumber;

			switch (changeType) {
				case ChangeType.Add:
					return {
						range: {
							startLineNumber: startLineNumber, startColumn: 1,
							endLineNumber: endLineNumber, endColumn: 1
						},
						options: pattern.added ? this.addedPatternOptions : this.addedOptions
					};
				case ChangeType.Delete:
					return {
						range: {
							startLineNumber: startLineNumber, startColumn: Number.MAX_VALUE,
							endLineNumber: startLineNumber, endColumn: Number.MAX_VALUE
						},
						options: this.deletedOptions
					};
				case ChangeType.Modify:
					return {
						range: {
							startLineNumber: startLineNumber, startColumn: 1,
							endLineNumber: endLineNumber, endColumn: 1
						},
						options: pattern.modified ? this.modifiedPatternOptions : this.modifiedOptions
					};
			}
		});

		this.decorations = this.editorModel.deltaDecorations(this.decorations, decorations);
	}

	override dispose(): void {
		super.dispose();

		if (this.editorModel && !this.editorModel.isDisposed()) {
			this.editorModel.deltaDecorations(this.decorations, []);
		}

		this.editorModel = null;
		this.decorations = [];
	}
}

function compareChanges(a: IChange, b: IChange): number {
	let result = a.modifiedStartLineNumber - b.modifiedStartLineNumber;

	if (result !== 0) {
		return result;
	}

	result = a.modifiedEndLineNumber - b.modifiedEndLineNumber;

	if (result !== 0) {
		return result;
	}

	result = a.originalStartLineNumber - b.originalStartLineNumber;

	if (result !== 0) {
		return result;
	}

	return a.originalEndLineNumber - b.originalEndLineNumber;
}


export async function getOriginalResource(quickDiffService: IQuickDiffService, uri: URI): Promise<URI | null> {
	const quickDiffs = await quickDiffService.getQuickDiffs(uri);
	return quickDiffs.length > 0 ? quickDiffs[0].originalResource : null;
}

export class DirtyDiffModel extends Disposable {

	private _originalResource: URI | null = null;
	private _originalModel: IResolvedTextEditorModel | null = null;
	private _model: ITextFileEditorModel;
	get original(): ITextModel | null { return this._originalModel?.textEditorModel || null; }
	get modified(): ITextModel | null { return this._model.textEditorModel || null; }

	private diffDelayer = new ThrottledDelayer<IChange[] | null>(200);
	private _originalURIPromise?: Promise<URI | null>;
	private repositoryDisposables = new Set<IDisposable>();
	private readonly originalModelDisposables = this._register(new DisposableStore());
	private _disposed = false;

	private readonly _onDidChange = new Emitter<{ changes: IChange[]; diff: ISplice<IChange>[] }>();
	readonly onDidChange: Event<{ changes: IChange[]; diff: ISplice<IChange>[] }> = this._onDidChange.event;

	private _changes: IChange[] = [];
	get changes(): IChange[] { return this._changes; }

	constructor(
		textFileModel: IResolvedTextFileEditorModel,
		@ISCMService private readonly scmService: ISCMService,
		@IQuickDiffService private readonly quickDiffService: IQuickDiffService,
		@IEditorWorkerService private readonly editorWorkerService: IEditorWorkerService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ITextModelService private readonly textModelResolverService: ITextModelService,
		@IProgressService private readonly progressService: IProgressService,
	) {
		super();
		this._model = textFileModel;

		this._register(textFileModel.textEditorModel.onDidChangeContent(() => this.triggerDiff()));
		this._register(
			Event.filter(configurationService.onDidChangeConfiguration,
				e => e.affectsConfiguration('scm.diffDecorationsIgnoreTrimWhitespace') || e.affectsConfiguration('diffEditor.ignoreTrimWhitespace')
			)(this.triggerDiff, this)
		);
		this._register(scmService.onDidAddRepository(this.onDidAddRepository, this));
		for (const r of scmService.repositories) {
			this.onDidAddRepository(r);
		}

		this._register(this._model.onDidChangeEncoding(() => {
			this.diffDelayer.cancel();
			this._originalResource = null;
			this._originalModel = null;
			this._originalURIPromise = undefined;
			this.setChanges([]);
			this.triggerDiff();
		}));

		this.triggerDiff();
	}

	private onDidAddRepository(repository: ISCMRepository): void {
		const disposables = new DisposableStore();

		this.repositoryDisposables.add(disposables);
		disposables.add(toDisposable(() => this.repositoryDisposables.delete(disposables)));

		const onDidChange = Event.any(repository.provider.onDidChange, repository.provider.onDidChangeResources);
		disposables.add(onDidChange(this.triggerDiff, this));

		const onDidRemoveThis = Event.filter(this.scmService.onDidRemoveRepository, r => r === repository);
		disposables.add(onDidRemoveThis(() => dispose(disposables), null));

		this.triggerDiff();
	}

	private triggerDiff(): Promise<any> {
		if (!this.diffDelayer) {
			return Promise.resolve(null);
		}

		return this.diffDelayer
			.trigger(() => this.diff())
			.then((changes: IChange[] | null) => {
				if (this._disposed || this._model.isDisposed() || !this._originalModel || this._originalModel.isDisposed()) {
					return; // disposed
				}

				if (this._originalModel.textEditorModel.getValueLength() === 0) {
					changes = [];
				}

				if (!changes) {
					changes = [];
				}

				this.setChanges(changes);
			}, (err) => onUnexpectedError(err));
	}

	private setChanges(changes: IChange[]): void {
		const diff = sortedDiff(this._changes, changes, compareChanges);
		this._changes = changes;
		this._onDidChange.fire({ changes, diff });
	}

	private diff(): Promise<IChange[] | null> {
		return this.progressService.withProgress({ location: ProgressLocation.Scm, delay: 250 }, async () => {
			return this.getOriginalURIPromise().then(originalURI => {
				if (this._disposed || this._model.isDisposed() || !originalURI) {
					return Promise.resolve([]); // disposed
				}

				if (!this.editorWorkerService.canComputeDirtyDiff(originalURI, this._model.resource)) {
					return Promise.resolve([]); // Files too large
				}

				const ignoreTrimWhitespaceSetting = this.configurationService.getValue<'true' | 'false' | 'inherit'>('scm.diffDecorationsIgnoreTrimWhitespace');
				const ignoreTrimWhitespace = ignoreTrimWhitespaceSetting === 'inherit'
					? this.configurationService.getValue<boolean>('diffEditor.ignoreTrimWhitespace')
					: ignoreTrimWhitespaceSetting !== 'false';

				return this.editorWorkerService.computeDirtyDiff(originalURI, this._model.resource, ignoreTrimWhitespace);
			});
		});
	}

	private getOriginalURIPromise(): Promise<URI | null> {
		if (this._originalURIPromise) {
			return this._originalURIPromise;
		}

		this._originalURIPromise = this.getOriginalResource().then(originalUri => {
			if (this._disposed) { // disposed
				return null;
			}

			if (!originalUri) {
				this._originalResource = null;
				this._originalModel = null;
				return null;
			}

			if (this._originalResource?.toString() === originalUri.toString()) {
				return originalUri;
			}

			return this.textModelResolverService.createModelReference(originalUri).then(ref => {
				if (this._disposed) { // disposed
					ref.dispose();
					return null;
				}

				this._originalResource = originalUri;
				this._originalModel = ref.object;

				if (isTextFileEditorModel(this._originalModel)) {
					const encoding = this._model.getEncoding();

					if (encoding) {
						this._originalModel.setEncoding(encoding, EncodingMode.Decode);
					}
				}

				this.originalModelDisposables.clear();
				this.originalModelDisposables.add(ref);
				this.originalModelDisposables.add(ref.object.textEditorModel.onDidChangeContent(() => this.triggerDiff()));

				return originalUri;
			}).catch(error => {
				return null; // possibly invalid reference
			});
		});

		return this._originalURIPromise.finally(() => {
			this._originalURIPromise = undefined;
		});
	}

	private async getOriginalResource(): Promise<URI | null> {
		if (this._disposed) {
			return Promise.resolve(null);
		}

		const uri = this._model.resource;
		return getOriginalResource(this.quickDiffService, uri);
	}

	findNextClosestChange(lineNumber: number, inclusive = true): number {
		for (let i = 0; i < this.changes.length; i++) {
			const change = this.changes[i];

			if (inclusive) {
				if (getModifiedEndLineNumber(change) >= lineNumber) {
					return i;
				}
			} else {
				if (change.modifiedStartLineNumber > lineNumber) {
					return i;
				}
			}
		}

		return 0;
	}

	findPreviousClosestChange(lineNumber: number, inclusive = true): number {
		for (let i = this.changes.length - 1; i >= 0; i--) {
			const change = this.changes[i];

			if (inclusive) {
				if (change.modifiedStartLineNumber <= lineNumber) {
					return i;
				}
			} else {
				if (getModifiedEndLineNumber(change) < lineNumber) {
					return i;
				}
			}
		}

		return this.changes.length - 1;
	}

	override dispose(): void {
		super.dispose();

		this._disposed = true;
		this._originalResource = null;
		this._originalModel = null;
		this.diffDelayer.cancel();
		this.repositoryDisposables.forEach(d => dispose(d));
		this.repositoryDisposables.clear();
	}
}

class DirtyDiffItem {

	constructor(
		readonly model: DirtyDiffModel,
		readonly decorator: DirtyDiffDecorator
	) { }

	dispose(): void {
		this.decorator.dispose();
		this.model.dispose();
	}
}

interface IViewState {
	readonly width: number;
	readonly visibility: 'always' | 'hover';
}

export class DirtyDiffWorkbenchController extends Disposable implements ext.IWorkbenchContribution, IModelRegistry {

	private enabled = false;
	private viewState: IViewState = { width: 3, visibility: 'always' };
	private items = new ResourceMap<DirtyDiffItem>();
	private readonly transientDisposables = this._register(new DisposableStore());
	private stylesheet: HTMLStyleElement;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ITextFileService private readonly textFileService: ITextFileService
	) {
		super();
		this.stylesheet = createStyleSheet();
		this._register(toDisposable(() => this.stylesheet.parentElement!.removeChild(this.stylesheet)));

		const onDidChangeConfiguration = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('scm.diffDecorations'));
		this._register(onDidChangeConfiguration(this.onDidChangeConfiguration, this));
		this.onDidChangeConfiguration();

		const onDidChangeDiffWidthConfiguration = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('scm.diffDecorationsGutterWidth'));
		onDidChangeDiffWidthConfiguration(this.onDidChangeDiffWidthConfiguration, this);
		this.onDidChangeDiffWidthConfiguration();

		const onDidChangeDiffVisibilityConfiguration = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('scm.diffDecorationsGutterVisibility'));
		onDidChangeDiffVisibilityConfiguration(this.onDidChangeDiffVisibiltiyConfiguration, this);
		this.onDidChangeDiffVisibiltiyConfiguration();
	}

	private onDidChangeConfiguration(): void {
		const enabled = this.configurationService.getValue<string>('scm.diffDecorations') !== 'none';

		if (enabled) {
			this.enable();
		} else {
			this.disable();
		}
	}

	private onDidChangeDiffWidthConfiguration(): void {
		let width = this.configurationService.getValue<number>('scm.diffDecorationsGutterWidth');

		if (isNaN(width) || width <= 0 || width > 5) {
			width = 3;
		}

		this.setViewState({ ...this.viewState, width });
	}

	private onDidChangeDiffVisibiltiyConfiguration(): void {
		const visibility = this.configurationService.getValue<'always' | 'hover'>('scm.diffDecorationsGutterVisibility');
		this.setViewState({ ...this.viewState, visibility });
	}

	private setViewState(state: IViewState): void {
		this.viewState = state;
		this.stylesheet.textContent = `
			.monaco-editor .dirty-diff-added,
			.monaco-editor .dirty-diff-modified {
				border-left-width:${state.width}px;
			}
			.monaco-editor .dirty-diff-added-pattern,
			.monaco-editor .dirty-diff-added-pattern:before,
			.monaco-editor .dirty-diff-modified-pattern,
			.monaco-editor .dirty-diff-modified-pattern:before {
				background-size: ${state.width}px ${state.width}px;
			}
			.monaco-editor .dirty-diff-added,
			.monaco-editor .dirty-diff-added-pattern,
			.monaco-editor .dirty-diff-modified,
			.monaco-editor .dirty-diff-modified-pattern,
			.monaco-editor .dirty-diff-deleted {
				opacity: ${state.visibility === 'always' ? 1 : 0};
			}
		`;
	}

	private enable(): void {
		if (this.enabled) {
			this.disable();
		}

		this.transientDisposables.add(Event.any(this.editorService.onDidCloseEditor, this.editorService.onDidVisibleEditorsChange)(() => this.onEditorsChanged()));
		this.onEditorsChanged();
		this.enabled = true;
	}

	private disable(): void {
		if (!this.enabled) {
			return;
		}

		this.transientDisposables.clear();

		for (const [, dirtyDiff] of this.items) {
			dirtyDiff.dispose();
		}

		this.items.clear();
		this.enabled = false;
	}

	private onEditorsChanged(): void {
		for (const editor of this.editorService.visibleTextEditorControls) {
			if (isCodeEditor(editor)) {
				const textModel = editor.getModel();
				const controller = DirtyDiffController.get(editor);

				if (controller) {
					controller.modelRegistry = this;
				}

				if (textModel && !this.items.has(textModel.uri)) {
					const textFileModel = this.textFileService.files.get(textModel.uri);

					if (textFileModel?.isResolved()) {
						const dirtyDiffModel = this.instantiationService.createInstance(DirtyDiffModel, textFileModel);
						const decorator = new DirtyDiffDecorator(textFileModel.textEditorModel, dirtyDiffModel, this.configurationService);
						this.items.set(textModel.uri, new DirtyDiffItem(dirtyDiffModel, decorator));
					}
				}
			}
		}

		for (const [uri, item] of this.items) {
			if (!this.editorService.isOpened({ resource: uri, typeId: FILE_EDITOR_INPUT_ID, editorId: DEFAULT_EDITOR_ASSOCIATION.id })) {
				item.dispose();
				this.items.delete(uri);
			}
		}
	}

	getModel(editorModel: ITextModel): DirtyDiffModel | undefined {
		return this.items.get(editorModel.uri)?.model;
	}

	override dispose(): void {
		this.disable();
		super.dispose();
	}
}

registerEditorContribution(DirtyDiffController.ID, DirtyDiffController, EditorContributionInstantiation.AfterFirstRender);
