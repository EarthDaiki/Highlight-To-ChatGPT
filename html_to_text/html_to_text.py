from bs4 import BeautifulSoup
import re

def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    # 不要タグ削除
    for tag in soup(["script", "style", "template"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    # 連続改行を整理
    text = re.sub(r"\n{3,}", "\n\n", text)

    # いらない引用符を削除
    text = text.translate(str.maketrans("", "", "“”\"'‘’"))

    return text


if __name__ == "__main__":
    with open("input.html", "r", encoding="utf-8") as f:
        html = f.read()

    result = html_to_text(html)

    with open("output1.txt", "w", encoding="utf-8") as f:
        f.write(result)
