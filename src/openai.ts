import type { CreateCompletionRequest } from '@fortaine/openai'
import { Configuration, OpenAIApi } from '@fortaine/openai'
import { streamCompletion } from '@fortaine/openai/stream'

export const createOpenAIClient = (apiKey: string) => {
    const config = new Configuration({
        apiKey,
    })
    const openai = new OpenAIApi(config)

    const getCompletion = async (
        options: CreateCompletionRequest &
        { onData?: (data: { response: string; stop: boolean }) => void },
    ) => {
        const completion = await openai.createCompletion({
            ...options,
            stream: true,
        }, { responseType: 'stream' })

        let response = ''

        for await (const data of streamCompletion(completion.data as any)) {
            try {
                const parsed = JSON.parse(data)
                const { text } = parsed.choices[0]
                let stop = false
                // Get stop reason
                if (parsed.choices[0].finish_reason === 'stop') {
                    stop = true
                }
                response += text
                if (options.onData) {
                    options.onData({ response, stop })
                }
            }
            catch (e) {
                console.error(e)
            }
        }

        return response
    }

    const getCodeCompletion = async (
        fullCode: string,
        selectedCode: string,
        language: string,
        onData: (data: { response: string; stop: boolean }) => void,
    ) => {
        const prompt = fullCode.replace(
            selectedCode.trim(),
            `<<START>>\n${selectedCode.trim()}\n<<END>>`,
        ).concat([
            `We ONLY take the text wrapped in between <<START>> and <<END>> and translate to code in the language ${language}, without the wrappers and without comments.`,
            'The converted code is following the structure from the code before and after it, and code conventions for the language.',
            `The code is fully compliant with the ${language} language. It will compile fine.`,
            `The code inside the wrappers is converted to the following ${language} code:`,
            '```\n',
        ].join('\n'))
        const max_tokens = Math.round(2048 - prompt.length / 3)

        const completion = await getCompletion({
            model: 'text-davinci-003',
            prompt,
            temperature: 0,
            top_p: 1,
            n: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            stop: '```',
            max_tokens,
            onData,
        })

        return completion
    }

    return { getCompletion, getCodeCompletion }
}
