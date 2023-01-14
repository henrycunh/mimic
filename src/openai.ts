import axios from 'axios'

export const createOpenAIClient = (apiKey: string) => {
    const client = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    })

    const getCodeCompletion = async (
        fullCode: string,
        selectedCode: string,
        language: string,
    ) => {
        // Replace the selected code with a placeholder
        const input = fullCode.replace(selectedCode.trim(), `<<<REPLACE_START>>>\n${selectedCode.trim()}\n<<<REPLACE_END>>>`)

        // Call the OpenAI API
        const response = await client.post('/edits', {
            model: 'code-davinci-edit-001',
            input,
            instruction: [
                `Replace the pseudocode wrapped in between <<<REPLACE_START>>> and <<<REPLACE_END>>> to code in the language ${language}`,
                'Keep the wrappers around the code generated from the pseudocode.',
                'The converted code should follow the style of the code around it.',
                'Be creative in understanding the syntax of the pseudocode.',
            ].join(' '),
            temperature: 0.5,
            top_p: 1,
            n: 1,
        }, {
            timeout: 10000,
            timeoutErrorMessage: 'API_TIMEOUT',
        })

        // Extract the code from the response
        const code = response.data.choices[0].text
        if (!code.includes('<<<REPLACE_START>>>')) {
            throw new Error('CODE_NOT_REPLACED')
        }
        return code.split('<<<REPLACE_START>>>')[1]?.split('<<<REPLACE_END>>>')[0]?.trim()
    }

    return {
        getCodeCompletion,
    }
}
