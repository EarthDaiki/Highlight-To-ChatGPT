document.addEventListener("DOMContentLoaded", async () => {
    const result = await chrome.storage.local.get([
        "openaiApiKey",
        "extraPrompt",
        "model",
        "maxOutputTokens",
    ]);

    if (result.openaiApiKey) {
        document.getElementById("apiKey").value = result.openaiApiKey;
        document.getElementById("settingContainer").hidden = false;
        await setModel(result.openaiApiKey);
    } else {
        createContinueBtn();
        handleApiKeyInput();
    }

    if (result.extraPrompt) {
        document.getElementById("extraPrompt").value = result.extraPrompt;
    }

    if (result.model) {
        document.getElementById("model").value = result.model;
    }

    if (result.maxOutputTokens) {
        document.getElementById("maxOutputTokens").value = result.maxOutputTokens;
    }

    document.getElementById("saveBtn").addEventListener("click", async () => {
        const apiKey = document.getElementById("apiKey").value.trim();
        const extraPrompt = document.getElementById("extraPrompt").value.trim();
        const model = document.getElementById("model").value.trim();
        const maxOutputTokens = Number(document.getElementById("maxOutputTokens").value.trim());
        const status = document.getElementById("status");
        
        if (maxOutputTokens < 100) {
            setMessage("Need to set 100 or more.");
            return;
        }
        await chrome.storage.local.set({
            openaiApiKey: apiKey,
            extraPrompt: extraPrompt,
            model: model,
            maxOutputTokens: maxOutputTokens,
        });

        status.textContent = "Settings saved.";

        setTimeout(() => {
            status.textContent = "";
        }, 2000);
    });
});

function createContinueBtn() {
    const apiKeyContainer = document.getElementById("apiKeyContainer");
    const continueBtn = document.createElement("button");
    continueBtn.id = "continueBtn";
    continueBtn.textContent = "Save & Continue";
    continueBtn.disabled = true;

    continueBtn.addEventListener("click", handleContinueClick);

    apiKeyContainer.appendChild(continueBtn);

    return continueBtn;
}

function handleApiKeyInput() {
    const input = document.getElementById("apiKey");
    const btn = document.getElementById("continueBtn");

    input.addEventListener("input", () => {
        btn.disabled = input.value.trim().length === 0;
    });
}

async function handleContinueClick() {
    const apiKey = document.getElementById("apiKey").value.trim();

    await chrome.storage.local.set({
        openaiApiKey: apiKey
    });

    await setModel(apiKey);
}

function setMessage(text) {
    const message = document.getElementById("message");
    message.hidden = false;
    const p = message.querySelector("p");
    p.textContent = text;
    p.style.color = "#ff4d4f";
    p.style.backgroundColor = "#1e1e1e";
    p.style.padding = "10px 14px";
    p.style.border = "1px solid #ff4d4f";
    p.style.borderRadius = "8px";
    p.style.fontWeight = "600";
    p.style.margin = "0";
}

async function setModel(apiKey) {
    const data = await getModels(apiKey);
    if (!data) { return; }

    document.getElementById("settingContainer").hidden = false;
    const continueBtn = document.getElementById("continueBtn");
    if (continueBtn) {
        continueBtn.remove();
    }

    const models = data.data.filter(model => {
        const id = model.id;

        return (
            (
                // modern GPT chat models
                id.startsWith("gpt-5") ||
                id.startsWith("gpt-4.1") ||
                id.startsWith("gpt-4o") ||

                // reasoning models
                id === "o1" ||
                id === "o3" ||
                id === "o4-mini" ||
                id.startsWith("o1-") ||
                id.startsWith("o3-") ||
                id.startsWith("o4-mini-") ||

                // web search capable models
                id.includes("search-preview") ||
                id.includes("search-api")
            )

            &&

            !(
                // exclude non-text variants
                id.includes("audio") ||
                id.includes("realtime") ||
                id.includes("transcribe") ||
                id.includes("tts") ||
                id.includes("image")
            )
        );
    });

    const select = document.getElementById("model");
    for (model of models) {
        const option = document.createElement("option");
        option.value = model.id;
        option.textContent = model.id;
        select.appendChild(option);
    }
}

async function getModels(apiKey) {
    const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });

    const data = await res.json();
    if (res.status != 200) {
        setMessage(data.error.message);
        return;
    }
    return data
}