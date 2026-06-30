const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_SMOKE_CHAT_ID;

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN.");
  process.exit(1);
}

async function telegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body: new URLSearchParams(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`${method} failed: ${data.description || res.statusText}`);
  }
  return data.result;
}

const me = await telegram("getMe", {});
console.log(`Bot OK: @${me.username || me.first_name} (${me.id})`);

if (chatId) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text: `Smoke test 收支核对 ${new Date().toISOString()}`,
    disable_web_page_preview: "true",
  });
  console.log(`Message OK: ${chatId}`);
}
