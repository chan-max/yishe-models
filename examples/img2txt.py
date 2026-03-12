from openai import OpenAI

client = OpenAI()

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": "https://qianwen-res.oss-accelerate.aliyuncs.com/Qwen3.5/demo/CI_Demo/mathv-1327.jpg"
                }
            },
            {
                "type": "text",
                "text": "请描述这张图片的内容。"
            }
        ]
    }
]

chat_response = client.chat.completions.create(
    model="Qwen/Qwen3.5-4B",
    messages=messages,
    max_tokens=1024,
    temperature=1.0,
    top_p=0.95,
)
print("图生文结果:", chat_response.choices[0].message.content)