import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import { getCurrentFileLanguage } from './language';
import { createOpenAIClient } from './openai';

const getApiKey = (context: vscode.ExtensionContext): string | undefined => vscode.workspace.getConfiguration('mimic').get('apiKey');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Check if user has a valid token
	const checkForAPIKey = () => {
		const apiKey = getApiKey(context);
		if (!apiKey) {
			// Show error message with a button that opens the settings
			showAPIAuthError('No OpenAI API key found. Please enter your OpenAI API key in the settings.');
		}
		return apiKey;
	};

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('mimic.convertPseudocodeToCode', async () => {
		const apiKey = getApiKey(context);
		if (!apiKey || !checkForAPIKey()) {
			return;
		}

		// Get the active text editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			// Show an error message if there is no active text editor
			vscode.window.showErrorMessage('No active text editor');
			return;
		}

		// Get the selected text
		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);
		const editorFullText = editor.document.getText();


		// Show an error message if there is no selected text
		if (!selectedText) {
			vscode.window.showErrorMessage('No selected text');
			return;
		}
		const language = getCurrentFileLanguage();
		// Show a message to the user
		vscode.window.showInformationMessage(
			`Converting pseudocode to code in ${language}...`
		);

		// Create a new client
		const { getCodeCompletion } = createOpenAIClient(apiKey);
		
		// Change colors of the lines selected, on the whole line, animated
		const setColor = (color: string) => {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: color,
				isWholeLine: true,
			});
			editor.setDecorations(decorationType, [selection]);
			return decorationType;
		};
		let alpha = 0.1;
		let direction = 1;
		let lastDecorationType: vscode.TextEditorDecorationType | undefined;
		const interval = setInterval(() => {
			const easeInOutCubic = (t: number): number => {
				if ((t /= 0.5) < 1) {
					return 0.5 * t * t * t;
				}
				return 0.5 * ((t -= 2) * t * t + 2);
			};
			const decoration = setColor(`rgba(36, 145, 229, ${easeInOutCubic(alpha)})`);
			if (lastDecorationType) {
				lastDecorationType.dispose();
			}
			lastDecorationType = decoration;
			alpha += 0.004 * direction;
			if (alpha >= 0.3) {
				direction = -1;
			}
			if (alpha <= 0.1) {
				direction = 1;
			}
		}, 10);
		// Add loading gutter icon
		const gutterIcon = context.asAbsolutePath('./src/loading.svg');
		const loadingIcon = vscode.window.createTextEditorDecorationType({
			gutterIconPath: gutterIcon,
			gutterIconSize: 'contain',
			isWholeLine: true,
			after: {
				contentText: `Converting pseudocode to ${language}...`,
				color: '#123b63',
				fontStyle: 'italic',
				margin: '0 0 0 32px',
			},
		});
		// Apply to the first line of the selection
		const firstLine = new vscode.Range(selection.start.line, 0, selection.start.line, 0);
		editor.setDecorations(loadingIcon, [firstLine]);

		let errorDecorationType: vscode.TextEditorDecorationType | undefined;

		try {
			const code = await getCodeCompletion(editorFullText, selectedText,  language as string);
			console.log({code, editorFullText});

			// Insert the code
			editor.edit((editBuilder) => {
				editBuilder.replace(selection, code);
			});

		} catch (error: any) {
			if (error instanceof AxiosError) {
				if (error.response?.status === 401) {
					// Show an error message if the API key is invalid
					showAPIAuthError('Invalid API key. Please enter a valid API key in the settings.');
					return;
				}
				if (error.message === 'API_TIMEOUT') {
					errorDecorationType = vscode.window.createTextEditorDecorationType({
						backgroundColor: 'rgba(255, 0, 0, 0.1)',
						isWholeLine: true,
						after: {
							contentText: 'API timed out. Please try again later.',
							color: 'rgba(255, 0, 0, 0.8)',
							fontStyle: 'italic',
							margin: '0 0 0 32px',
						},
					});
					// Apply to the first line of the selection
					editor.setDecorations(errorDecorationType, [firstLine]);
					setTimeout(() => {
						if (errorDecorationType) {
							errorDecorationType.dispose();
						}
					}, 2000);
					// Show an error message if the API timed out
					vscode.window.showErrorMessage('API timed out. Please try again later.');
					return;
				}
				vscode.window.showErrorMessage("Error while converting pseudocode:\n" + JSON.stringify(error.message));
			}
			if (error.message === 'CODE_NOT_REPLACED') {
				errorDecorationType = vscode.window.createTextEditorDecorationType({
					backgroundColor: 'rgba(255, 0, 0, 0.1)',
					isWholeLine: true,
					after: {
						contentText: 'Error while converting pseudocode. Please try again later.',
						color: 'rgba(255, 0, 0, 0.8)',
						fontStyle: 'italic',
						margin: '0 0 0 32px',
					},
				});
				// Apply to the first line of the selection
				editor.setDecorations(errorDecorationType, [firstLine]);
				setTimeout(() => {
					if (errorDecorationType) {
						errorDecorationType.dispose();
					}
				}, 2000);
			}
			return;
		} finally {
			// Clear the interval
			clearInterval(interval);
			if (lastDecorationType) {
				lastDecorationType.dispose();
			}
			loadingIcon.dispose();
		}
	});
	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function showAPIAuthError (error: string) {
	vscode.window.showErrorMessage(
		error,
		'Open Settings',
		'Input API Key'
	).then((selection) => {
		if (selection === 'Open Settings') {
			vscode.commands.executeCommand('workbench.action.openSettings', 'mimic.apiKey');
		}
		if (selection === 'Input API Key') {
			vscode.window.showInputBox({
				placeHolder: 'Enter your API key',
				validateInput: (value) => {
					if (!value) {
						return 'Please enter a valid API key';
					}
					return null;
				}
			}).then((value) => {
				if (value) {
					vscode.workspace.getConfiguration('mimic').update('apiKey', value, true);
				}
			});
		}
	});
}