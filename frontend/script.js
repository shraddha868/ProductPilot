const input = document.querySelector('#input');
const chatContainer = document.querySelector('#chat-container');
const messagesEl = document.querySelector('#messages');
const askBtn = document.querySelector('#ask');

input?.addEventListener('keyup', handleEnter);
askBtn?.addEventListener('click', handleAsk);

const loading = document.createElement('div');
loading.className = 'loading';
loading.textContent = 'Thinking...';

async function generate(text) {
    // 1. Append user message to UI
    const msg = document.createElement('div');
    msg.className = `message user`;
    msg.textContent = text;
    messagesEl?.appendChild(msg);
    input.value = '';

    // ensure newest visible
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // 2. Show loading animation
    messagesEl?.appendChild(loading);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // 3. Call backend API
    const assistantMessage = await callServer(text);

    // 4. Add assistant message
    const assistantMsgElem = document.createElement('div');
    assistantMsgElem.className = `message assistant`;
    assistantMsgElem.style.whiteSpace = "pre-wrap"; // preserves new lines
    assistantMsgElem.textContent = assistantMessage;

    loading.remove();
    messagesEl?.appendChild(assistantMsgElem);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function callServer(inputText) {
    const response = await fetch('http://localhost:3002/chat', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({ message: inputText }), // thread removed
    });

    if (!response.ok) {
        throw new Error('Error generating the response.');
    }

    const result = await response.json();
    return result.message;
}

async function handleAsk() {
    const text = input?.value.trim();
    if (!text) return;
    await generate(text);
}

async function handleEnter(e) {
    if (e.key === 'Enter') {
        const text = input?.value.trim();
        if (!text) return;
        await generate(text);
    }
}
