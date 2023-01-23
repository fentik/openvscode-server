/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IButtonStyles } from 'vs/base/browser/ui/button/button';
import { IKeybindingLabelStyles } from 'vs/base/browser/ui/keybindingLabel/keybindingLabel';
import { ColorIdentifier, keybindingLabelBackground, keybindingLabelBorder, keybindingLabelBottomBorder, keybindingLabelForeground, asCssVariable, widgetShadow, buttonForeground, buttonSeparator, buttonBackground, buttonHoverBackground, buttonSecondaryForeground, buttonSecondaryBackground, buttonSecondaryHoverBackground, buttonBorder, progressBarBackground, inputActiveOptionBorder, inputActiveOptionForeground, inputActiveOptionBackground, editorWidgetBackground, editorWidgetForeground, contrastBorder, checkboxBorder, checkboxBackground, checkboxForeground, problemsErrorIconForeground, problemsWarningIconForeground, problemsInfoIconForeground, inputBackground, inputForeground, inputBorder, textLinkForeground, inputValidationInfoBorder, inputValidationInfoBackground, inputValidationInfoForeground, inputValidationWarningBorder, inputValidationWarningBackground, inputValidationWarningForeground, inputValidationErrorBorder, inputValidationErrorBackground, inputValidationErrorForeground, listFilterWidgetBackground, listFilterWidgetNoMatchesOutline, listFilterWidgetOutline, listFilterWidgetShadow, badgeBackground, badgeForeground, breadcrumbsBackground, breadcrumbsForeground, breadcrumbsFocusForeground, breadcrumbsActiveSelectionForeground, activeContrastBorder, listActiveSelectionBackground, listActiveSelectionForeground, listActiveSelectionIconForeground, listDropBackground, listFocusAndSelectionOutline, listFocusBackground, listFocusForeground, listFocusOutline, listHoverBackground, listHoverForeground, listInactiveFocusBackground, listInactiveFocusOutline, listInactiveSelectionBackground, listInactiveSelectionForeground, listInactiveSelectionIconForeground, tableColumnsBorder, tableOddRowsBackgroundColor, treeIndentGuidesStroke, asCssVariableWithDefault, editorWidgetBorder, focusBorder, pickerGroupForeground, quickInputListFocusBackground, quickInputListFocusForeground, quickInputListFocusIconForeground, selectBackground, selectBorder, selectForeground, selectListBackground, treeInactiveIndentGuidesStroke, menuBorder, menuForeground, menuBackground, menuSelectionForeground, menuSelectionBackground, menuSelectionBorder, menuSeparatorBackground, scrollbarShadow, scrollbarSliderActiveBackground, scrollbarSliderBackground, scrollbarSliderHoverBackground } from 'vs/platform/theme/common/colorRegistry';
import { IProgressBarStyles } from 'vs/base/browser/ui/progressbar/progressbar';
import { ICheckboxStyles, IToggleStyles } from 'vs/base/browser/ui/toggle/toggle';
import { IDialogStyles } from 'vs/base/browser/ui/dialog/dialog';
import { IInputBoxStyles } from 'vs/base/browser/ui/inputbox/inputBox';
import { IFindWidgetStyles } from 'vs/base/browser/ui/tree/abstractTree';
import { ICountBadgeStyles } from 'vs/base/browser/ui/countBadge/countBadge';
import { IBreadcrumbsWidgetStyles } from 'vs/base/browser/ui/breadcrumbs/breadcrumbsWidget';
import { IListStyles } from 'vs/base/browser/ui/list/listWidget';
import { ISelectBoxStyles } from 'vs/base/browser/ui/selectBox/selectBox';
import { Color } from 'vs/base/common/color';
import { IMenuStyles } from 'vs/base/browser/ui/menu/menu';

export type IStyleOverride<T> = {
	[P in keyof T]?: ColorIdentifier;
};

export const defaultKeybindingLabelStyles = getKeybindingLabelStyles({});

export function getKeybindingLabelStyles(override: IStyleOverride<IKeybindingLabelStyles>): IKeybindingLabelStyles {
	return {
		keybindingLabelBackground: asCssVariable(override.keybindingLabelBackground ?? keybindingLabelBackground),
		keybindingLabelForeground: asCssVariable(override.keybindingLabelForeground ?? keybindingLabelForeground),
		keybindingLabelBorder: asCssVariable(override.keybindingLabelBorder ?? keybindingLabelBorder),
		keybindingLabelBottomBorder: asCssVariable(override.keybindingLabelBottomBorder ?? keybindingLabelBottomBorder),
		keybindingLabelShadow: asCssVariable(override.keybindingLabelShadow ?? widgetShadow)
	};
}
export const defaultButtonStyles: IButtonStyles = getButtonStyles({});

export function getButtonStyles(override: IStyleOverride<IButtonStyles>): IButtonStyles {
	return {
		buttonForeground: asCssVariable(override.buttonForeground ?? buttonForeground),
		buttonSeparator: asCssVariable(override.buttonSeparator ?? buttonSeparator),
		buttonBackground: asCssVariable(override.buttonBackground ?? buttonBackground),
		buttonHoverBackground: asCssVariable(override.buttonHoverBackground ?? buttonHoverBackground),
		buttonSecondaryForeground: asCssVariable(override.buttonSecondaryForeground ?? buttonSecondaryForeground),
		buttonSecondaryBackground: asCssVariable(override.buttonSecondaryBackground ?? buttonSecondaryBackground),
		buttonSecondaryHoverBackground: asCssVariable(override.buttonSecondaryHoverBackground ?? buttonSecondaryHoverBackground),
		buttonBorder: asCssVariable(override.buttonBorder ?? buttonBorder),
	};
}

export const defaultProgressBarStyles: IProgressBarStyles = getProgressBarStyles({});

export function getProgressBarStyles(override: IStyleOverride<IProgressBarStyles>): IProgressBarStyles {
	return {
		progressBarBackground: asCssVariable(override.progressBarBackground ?? progressBarBackground)
	};
}

export const defaultToggleStyles: IToggleStyles = getToggleStyles({});

export function getToggleStyles(override: IStyleOverride<IToggleStyles>): IToggleStyles {
	return {
		inputActiveOptionBorder: asCssVariable(override.inputActiveOptionBorder ?? inputActiveOptionBorder),
		inputActiveOptionForeground: asCssVariable(override.inputActiveOptionForeground ?? inputActiveOptionForeground),
		inputActiveOptionBackground: asCssVariable(override.inputActiveOptionBackground ?? inputActiveOptionBackground)
	};
}

export const defaultCheckboxStyles: ICheckboxStyles = getCheckboxStyles({});

export function getCheckboxStyles(override: IStyleOverride<ICheckboxStyles>): ICheckboxStyles {
	return {
		checkboxBackground: asCssVariable(override.checkboxBackground ?? checkboxBackground),
		checkboxBorder: asCssVariable(override.checkboxBorder ?? checkboxBorder),
		checkboxForeground: asCssVariable(override.checkboxForeground ?? checkboxForeground)
	};
}

export const defaultDialogStyles = getDialogStyle({});

export function getDialogStyle(override: IStyleOverride<IDialogStyles>): IDialogStyles {
	return {
		dialogBackground: asCssVariable(override.dialogBackground ?? editorWidgetBackground),
		dialogForeground: asCssVariable(override.dialogForeground ?? editorWidgetForeground),
		dialogShadow: asCssVariable(override.dialogShadow ?? widgetShadow),
		dialogBorder: asCssVariable(override.dialogBorder ?? contrastBorder),
		errorIconForeground: asCssVariable(override.errorIconForeground ?? problemsErrorIconForeground),
		warningIconForeground: asCssVariable(override.warningIconForeground ?? problemsWarningIconForeground),
		infoIconForeground: asCssVariable(override.infoIconForeground ?? problemsInfoIconForeground),
		textLinkForeground: asCssVariable(override.textLinkForeground ?? textLinkForeground)
	};
}

export const defaultInputBoxStyles = getInputBoxStyle({});

export function getInputBoxStyle(override: IStyleOverride<IInputBoxStyles>): IInputBoxStyles {
	return {
		inputBackground: asCssVariable(override.inputBackground ?? inputBackground),
		inputForeground: asCssVariable(override.inputForeground ?? inputForeground),
		inputBorder: asCssVariable(override.inputBorder ?? inputBorder),
		inputValidationInfoBorder: asCssVariable(override.inputValidationInfoBorder ?? inputValidationInfoBorder),
		inputValidationInfoBackground: asCssVariable(override.inputValidationInfoBackground ?? inputValidationInfoBackground),
		inputValidationInfoForeground: asCssVariable(override.inputValidationInfoForeground ?? inputValidationInfoForeground),
		inputValidationWarningBorder: asCssVariable(override.inputValidationWarningBorder ?? inputValidationWarningBorder),
		inputValidationWarningBackground: asCssVariable(override.inputValidationWarningBackground ?? inputValidationWarningBackground),
		inputValidationWarningForeground: asCssVariable(override.inputValidationWarningForeground ?? inputValidationWarningForeground),
		inputValidationErrorBorder: asCssVariable(override.inputValidationErrorBorder ?? inputValidationErrorBorder),
		inputValidationErrorBackground: asCssVariable(override.inputValidationErrorBackground ?? inputValidationErrorBackground),
		inputValidationErrorForeground: asCssVariable(override.inputValidationErrorForeground ?? inputValidationErrorForeground)
	};
}

export const defaultFindWidgetStyles: IFindWidgetStyles = {
	listFilterWidgetBackground: asCssVariable(listFilterWidgetBackground),
	listFilterWidgetOutline: asCssVariable(listFilterWidgetOutline),
	listFilterWidgetNoMatchesOutline: asCssVariable(listFilterWidgetNoMatchesOutline),
	listFilterWidgetShadow: asCssVariable(listFilterWidgetShadow),
	inputBoxStyles: defaultInputBoxStyles,
	toggleStyles: defaultToggleStyles
};

export const defaultCountBadgeStyles = getCountBadgeStyle({});

export function getCountBadgeStyle(override: IStyleOverride<ICountBadgeStyles>): ICountBadgeStyles {
	return {
		badgeBackground: asCssVariable(override.badgeBackground ?? badgeBackground),
		badgeForeground: asCssVariable(override.badgeForeground ?? badgeForeground),
		badgeBorder: asCssVariable(contrastBorder)
	};
}

export const defaultBreadcrumbsWidgetStyles = getBreadcrumbsWidgetStyles({});

export function getBreadcrumbsWidgetStyles(override: IStyleOverride<IBreadcrumbsWidgetStyles>): IBreadcrumbsWidgetStyles {
	return {
		breadcrumbsBackground: asCssVariable(override.breadcrumbsBackground ?? breadcrumbsBackground),
		breadcrumbsForeground: asCssVariable(override.breadcrumbsForeground ?? breadcrumbsForeground),
		breadcrumbsHoverForeground: asCssVariable(override.breadcrumbsFocusForeground ?? breadcrumbsFocusForeground),
		breadcrumbsFocusForeground: asCssVariable(override.breadcrumbsFocusForeground ?? breadcrumbsFocusForeground),
		breadcrumbsFocusAndSelectionForeground: asCssVariable(override.breadcrumbsFocusAndSelectionForeground ?? breadcrumbsActiveSelectionForeground)
	};
}

export const defaultListStyles = getListStyles({});

export function getListStyles(override: IStyleOverride<IListStyles>): IListStyles {
	return {
		listBackground: override.listBackground ? asCssValue(override.listBackground) : undefined,
		listInactiveFocusForeground: override.listInactiveFocusForeground ? asCssValue(override.listInactiveFocusForeground) : undefined,
		listFocusBackground: asCssValue(override.listFocusBackground ?? listFocusBackground),
		listFocusForeground: asCssValue(override.listFocusForeground ?? listFocusForeground),
		listFocusOutline: asCssValue(override.listFocusOutline ?? listFocusOutline),
		listActiveSelectionBackground: asCssValue(override.listActiveSelectionBackground ?? listActiveSelectionBackground),
		listActiveSelectionForeground: asCssValue(override.listActiveSelectionForeground ?? listActiveSelectionForeground),
		listActiveSelectionIconForeground: asCssValue(override.listActiveSelectionIconForeground ?? listActiveSelectionIconForeground),
		listFocusAndSelectionOutline: asCssValue(override.listFocusAndSelectionOutline ?? listFocusAndSelectionOutline),
		listFocusAndSelectionBackground: asCssValue(override.listFocusAndSelectionBackground ?? listActiveSelectionBackground),
		listFocusAndSelectionForeground: asCssValue(override.listFocusAndSelectionForeground ?? listActiveSelectionForeground),
		listInactiveSelectionBackground: asCssValue(override.listInactiveSelectionBackground ?? listInactiveSelectionBackground),
		listInactiveSelectionIconForeground: asCssValue(override.listInactiveSelectionIconForeground ?? listInactiveSelectionIconForeground),
		listInactiveSelectionForeground: asCssValue(override.listInactiveSelectionForeground ?? listInactiveSelectionForeground),
		listInactiveFocusBackground: asCssValue(override.listInactiveFocusBackground ?? listInactiveFocusBackground),
		listInactiveFocusOutline: asCssValue(override.listInactiveFocusOutline ?? listInactiveFocusOutline),
		listHoverBackground: asCssValue(override.listHoverBackground ?? listHoverBackground),
		listHoverForeground: asCssValue(override.listHoverForeground ?? listHoverForeground),
		listDropBackground: asCssValue(override.listDropBackground ?? listDropBackground),
		listSelectionOutline: asCssValue(override.listSelectionOutline ?? activeContrastBorder),
		listHoverOutline: asCssValue(override.listHoverOutline ?? activeContrastBorder),
		treeIndentGuidesStroke: asCssValue(override.treeIndentGuidesStroke ?? treeIndentGuidesStroke),
		treeInactiveIndentGuidesStroke: asCssValue(override.treeInactiveIndentGuidesStroke ?? treeInactiveIndentGuidesStroke),
		tableColumnsBorder: asCssValue(override.tableColumnsBorder ?? tableColumnsBorder),
		tableOddRowsBackgroundColor: asCssValue(override.tableOddRowsBackgroundColor ?? tableOddRowsBackgroundColor),
	};
}

export const defaultSelectBoxStyles = getSelectBoxStyles({});

export function getSelectBoxStyles(override: IStyleOverride<ISelectBoxStyles>): ISelectBoxStyles {
	return {
		selectBackground: asCssValue(override.selectBackground || selectBackground),
		selectListBackground: asCssValue(override.selectListBackground || selectListBackground),
		selectForeground: asCssValue(override.selectForeground || selectForeground),
		decoratorRightForeground: asCssValue(override.decoratorRightForeground || pickerGroupForeground),
		selectBorder: asCssValue(override.selectBorder || selectBorder),
		focusBorder: asCssValue(override.focusBorder || focusBorder),
		listFocusBackground: asCssValue(override.listFocusBackground || quickInputListFocusBackground),
		listInactiveSelectionIconForeground: asCssValue(override.listInactiveSelectionIconForeground || quickInputListFocusIconForeground),
		listFocusForeground: asCssValue(override.listFocusForeground || quickInputListFocusForeground),
		listFocusOutline: asCssValueWithDefault(override.listFocusOutline ?? activeContrastBorder, Color.transparent.toString()),
		listHoverBackground: asCssValue(override.listHoverBackground || listHoverBackground),
		listHoverForeground: asCssValue(override.listHoverForeground || listHoverForeground),
		listHoverOutline: asCssValue(override.listFocusOutline || activeContrastBorder),
		selectListBorder: asCssValue(override.selectListBorder || editorWidgetBorder),
		listBackground: undefined,
		listActiveSelectionBackground: undefined,
		listActiveSelectionForeground: undefined,
		listActiveSelectionIconForeground: undefined,
		listFocusAndSelectionBackground: undefined,
		listDropBackground: undefined,
		listInactiveSelectionBackground: undefined,
		listInactiveSelectionForeground: undefined,
		listInactiveFocusBackground: undefined,
		listInactiveFocusOutline: undefined,
		listSelectionOutline: undefined,
		listFocusAndSelectionForeground: undefined,
		listFocusAndSelectionOutline: undefined,
		listInactiveFocusForeground: undefined,
		tableColumnsBorder: undefined,
		tableOddRowsBackgroundColor: undefined,
		treeIndentGuidesStroke: undefined,
		treeInactiveIndentGuidesStroke: undefined,
	};
}


export const defaultMenuStyles = getMenuStyles({});

export function getMenuStyles(override: IStyleOverride<IMenuStyles>): IMenuStyles {
	return {
		shadowColor: asCssValue(override.shadowColor ?? widgetShadow),
		borderColor: asCssValue(override.borderColor ?? menuBorder),
		foregroundColor: asCssValue(override.foregroundColor ?? menuForeground),
		backgroundColor: asCssValue(override.backgroundColor ?? menuBackground),
		selectionForegroundColor: asCssValue(override.selectionForegroundColor ?? menuSelectionForeground),
		selectionBackgroundColor: asCssValue(override.selectionBackgroundColor ?? menuSelectionBackground),
		selectionBorderColor: asCssValue(override.selectionBorderColor ?? menuSelectionBorder),
		separatorColor: asCssValue(override.separatorColor ?? menuSeparatorBackground),
		scrollbarShadow: asCssValue(override.scrollbarShadow ?? scrollbarShadow),
		scrollbarSliderBackground: asCssValue(override.scrollbarSliderBackground ?? scrollbarSliderBackground),
		scrollbarSliderHoverBackground: asCssValue(override.scrollbarSliderHoverBackground ?? scrollbarSliderHoverBackground),
		scrollbarSliderActiveBackground: asCssValue(override.scrollbarSliderActiveBackground ?? scrollbarSliderActiveBackground)
	};
}
