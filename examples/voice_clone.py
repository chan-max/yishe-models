import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel

# 加载模型（已通过HF安装）
model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    device_map="cuda:0",
    dtype=torch.bfloat16,
    attn_implementation="flash_attention_2",
)

# 参考音频和文本
ref_audio = "https://1storage-1257307499.cos.ap-beijing.myqcloud.com/ai-tts/20260312/system/49be40b0-6eee-45d2-acc9-daf183a3f7e8/1773279876730_tts_49be40b0-6eee-45d2-acc9-daf183a3f7e8.mp3"
ref_text  = "今天天气真不错"

# 合成新语音
wavs, sr = model.generate_voice_clone(
    text="你是谁",
    language="Chinese",
    ref_audio=ref_audio,
    ref_text=ref_text,
)

# 保存结果
sf.write("测试.wav", wavs[0], sr)
print("Voice clone synthesis complete. Output: 测试.wav")
