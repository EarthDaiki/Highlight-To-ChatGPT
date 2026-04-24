/* background.js */

let elementId = "";

chrome.runtime.onInstalled.addListener(async () => {
    const current = await getData();

    const defaults = {
        openaiApiKey: "",
        extraPrompt: "",
        model: "",
        maxOutputTokens: 500
    };

    await chrome.storage.local.set({
        openaiApiKey: current.openaiApiKey ?? defaults.openaiApiKey,
        extraPrompt: current.extraPrompt ?? defaults.extraPrompt,
        model: current.model ?? defaults.model,
        maxOutputTokens: current.maxOutputTokens ?? defaults.maxOutputTokens
    });

    chrome.contextMenus.create({
        id: "ask-chatgpt-text",
        title: "Ask ChatGPT (selected text)",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "ask-chatgpt-image",
        title: "Ask ChatGPT (crop image area)",
        contexts: ["page", "selection"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {

    if (!tab?.id) return;

    const { openaiApiKey, extraPrompt } =
        await chrome.storage.local.get([
            "openaiApiKey",
            "extraPrompt"
        ]);

    if (!openaiApiKey) {
        chrome.action.openPopup();
        return;
    }

    try {

        /* ---------------- TEXT ---------------- */
        if (info.menuItemId === "ask-chatgpt-text") {

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: showAnswer,
                args: ["Loading..."]
            });

            const finalInput =
                extraPrompt
                    ? extraPrompt +
                    "\n\n" +
                    info.selectionText
                    : info.selectionText;

            const answer =
                await askChatGPTText(
                    openaiApiKey,
                    finalInput
                );

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: showAnswer,
                args: [answer]
            });

            return;
        }

        /* ---------------- IMAGE ---------------- */
        if (info.menuItemId === "ask-chatgpt-image") {

            const result =
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: startCropMode
                });

            const area =
                result?.[0]?.result;

            if (!area) return;

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: showAnswer,
                args: ["Loading..."]
            });

            /* 画面全体スクショ */
            const screenshot =
                await chrome.tabs.captureVisibleTab(
                    tab.windowId,
                    { format: "png" }
                );

            /* page側でcrop */
            const cropResult =
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: cropImageOnPage,
                    args: [screenshot, area]
                });

            const croppedImage =
                cropResult?.[0]?.result;

            if (!croppedImage)
                throw new Error(
                    "Crop failed"
                );

            const prompt =
                extraPrompt ||
                "Analyze this image.";

            const answer =
                await askChatGPTImage(
                    openaiApiKey,
                    croppedImage,
                    prompt
                );

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: showAnswer,
                args: [answer]
            });

            return;
        }

    } catch (e) {

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: showAnswer,
            args: [
                "Error: " + e.message
            ]
        });
    }
});

/* ---------------- TEXT API ---------------- */
async function askChatGPTText(apiKey,text) {
    const storageData = await getData();
    const res = await fetch(
        "https://api.openai.com/v1/responses",
        {
            method: "POST",
            headers: {
                Authorization:
                    "Bearer " + apiKey,
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify({
                model: storageData.model,
                input: text,
                max_output_tokens: storageData.maxOutputTokens
            })
        }
    );

    const data = await res.json();

    if (!res.ok)
        throw new Error(
            data.error?.message ||
            "API request failed"
        );

    return extractText(data);
}

/* ---------------- IMAGE API ---------------- */
async function askChatGPTImage(apiKey, image, prompt) {
    const storageData = await getData();
    const res = await fetch(
        "https://api.openai.com/v1/responses",
        {
            method: "POST",
            headers: {
                Authorization:
                    "Bearer " + apiKey,
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify({
                model: storageData.model,
                input: [
                    {
                        role: "user",
                        content: [
                            {
                                type:
                                    "input_text",
                                text:
                                    prompt
                            },
                            {
                                type:
                                    "input_image",
                                image_url:
                                    image
                            }
                        ]
                    }
                ],
                max_output_tokens: storageData.maxOutputTokens
            })
        }
    );

    const data = await res.json();

    if (!res.ok)
        throw new Error(
            data.error?.message ||
            "API request failed"
        );

    return extractText(data);
}

/* ---------------- RESPONSE ---------------- */
function extractText(data) {

    return (
        data.output_text ||
        data.output?.[0]?.content
            ?.find(
                x =>
                    x.type ===
                    "output_text"
            )
            ?.text ||
        "No response."
    );
}

/* ---------------- CROP UI ---------------- */
async function startCropMode() {

    if (
        document.getElementById(
            "crop-overlay"
        )
    ) return null;

    return await new Promise(
        resolve => {

            let startX = 0;
            let startY = 0;
            let dragging = false;

            const overlay =
                document.createElement(
                    "div"
                );

            overlay.id =
                "crop-overlay";

            overlay.style.position =
                "fixed";

            overlay.style.left = "0";
            overlay.style.top = "0";

            overlay.style.width =
                "100vw";

            overlay.style.height =
                "100vh";

            overlay.style.zIndex =
                "2147483647";

            overlay.style.cursor =
                "crosshair";

            overlay.style.background =
                "rgba(0,0,0,.15)";

            const box =
                document.createElement(
                    "div"
                );

            box.style.position =
                "fixed";

            box.style.border =
                "2px solid #00ff99";

            box.style.background =
                "rgba(0,255,120,.15)";

            box.style.pointerEvents =
                "none";

            box.style.display =
                "none";

            overlay.appendChild(box);

            document.body.appendChild(
                overlay
            );

            function move(ev) {

                if (!dragging) return;

                const x =
                    Math.min(
                        startX,
                        ev.clientX
                    );

                const y =
                    Math.min(
                        startY,
                        ev.clientY
                    );

                const w =
                    Math.abs(
                        ev.clientX -
                        startX
                    );

                const h =
                    Math.abs(
                        ev.clientY -
                        startY
                    );

                box.style.display =
                    "block";

                box.style.left =
                    x + "px";

                box.style.top =
                    y + "px";

                box.style.width =
                    w + "px";

                box.style.height =
                    h + "px";
            }

            function up(ev) {

                if (!dragging)
                    return;

                dragging = false;

                document.removeEventListener(
                    "mousemove",
                    move,
                    true
                );

                document.removeEventListener(
                    "mouseup",
                    up,
                    true
                );

                const x =
                    Math.min(
                        startX,
                        ev.clientX
                    );

                const y =
                    Math.min(
                        startY,
                        ev.clientY
                    );

                const w =
                    Math.abs(
                        ev.clientX -
                        startX
                    );

                const h =
                    Math.abs(
                        ev.clientY -
                        startY
                    );

                overlay.remove();

                if (
                    w < 10 ||
                    h < 10
                ) {
                    resolve(null);
                    return;
                }

                resolve({
                    x: x,
                    y: y,
                    width: w,
                    height: h,
                    scale:
                        window.devicePixelRatio ||
                        1
                });
            }

            overlay.addEventListener(
                "mousedown",
                e => {

                    e.preventDefault();

                    dragging =
                        true;

                    startX =
                        e.clientX;

                    startY =
                        e.clientY;

                    document.addEventListener(
                        "mousemove",
                        move,
                        true
                    );

                    document.addEventListener(
                        "mouseup",
                        up,
                        true
                    );
                },
                true
            );
        }
    );
}

/* ---------------- IMAGE CROP ---------------- */
async function cropImageOnPage(
    dataUrl,
    area
) {

    return await new Promise(resolve => {

        const img =
            new Image();

        img.onload = () => {

            const canvas =
                document.createElement(
                    "canvas"
                );

            canvas.width =
                area.width;

            canvas.height =
                area.height;

            const ctx =
                canvas.getContext(
                    "2d"
                );

            ctx.drawImage(
                img,
                area.x *
                area.scale,
                area.y *
                area.scale,
                area.width *
                area.scale,
                area.height *
                area.scale,
                0,
                0,
                area.width,
                area.height
            );

            resolve(
                canvas.toDataURL(
                    "image/png"
                )
            );
        };

        img.onerror = () => {
            resolve(null);
        };

        img.src = dataUrl;
    });
}

function getRandom(length) {
    return Array.from({ length: length }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

async function getData() {
    return await chrome.storage.local.get([
        "openaiApiKey",
        "extraPrompt",
        "model",
        "maxOutputTokens"
    ]);
}

/* ---------------- UI ---------------- */
function showAnswer(answer) {

    const old = document.getElementById("box");
    if (old) old.remove();

    const box = document.createElement("div");
    box.id = "box";

    box.style.position = "fixed";
    box.style.left = "0";
    box.style.right = "0";
    box.style.bottom = "0";
    box.style.maxHeight = "35vh";
    box.style.overflowY = "auto";
    box.style.padding = "20px";
    box.style.zIndex = "2147483647";
    box.style.background = "#111";
    box.style.color = "#fff";
    box.style.fontSize = "14px";
    box.style.borderTop = "1px solid #333";
    box.style.whiteSpace = "pre-wrap";

    const closeBtn = document.createElement("span");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.float = "right";
    closeBtn.style.fontSize = "52px";
    closeBtn.style.fontWeight = "bold";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.color = "#ff4d4d";
    closeBtn.style.marginLeft = "15px";
    closeBtn.style.lineHeight = "1";

    closeBtn.onclick = function () {
        box.remove();
    };

    const text = document.createElement("div");
    text.textContent = answer;

    box.appendChild(closeBtn);
    box.appendChild(text);

    document.body.appendChild(box);
}