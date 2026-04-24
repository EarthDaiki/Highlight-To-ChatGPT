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
        const maxOutputTokens = document.getElementById("maxOutputTokens").value.trim();
        const status = document.getElementById("status");

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

    document.getElementById("settingContainer").hidden = false;
    document.getElementById("continueBtn").remove();
}

async function setModel(apiKey) {
    const models = await getModels(apiKey);
    console.log(models);
}

async function getModels(apiKey) {
    const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });

    const data = await res.json();
    return data.data.map(m => m.id);
}