const fs = require("fs");
const UniswapBot = require("./src/routers/uniswap");

const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

function getRandomAmount() {
  return (Math.random() * (0.01 - 0.001) + 0.001).toFixed(6); // Acak antara 0.001 - 0.01 ETH
}

async function startBotForAccount(account) {
  async function executeTrade() {
    const amount = getRandomAmount();
    const bot = new UniswapBot({
      amount: amount,
      privateKey: account.privateKey,
    });

    console.log(
      `💰 Trading ${amount} ETH untuk akun ${account.privateKey.slice(-6)}`
    );

    await bot.run();

    const delay =
      Math.floor(
        Math.random() * (account.intervalMax - account.intervalMin) +
          account.intervalMin
      ) *
      60 *
      1000;
    console.log(
      `🕒 Akun ${account.privateKey.slice(-6)} akan trading lagi dalam ${
        delay / 60000
      } menit\n`
    );

    setTimeout(executeTrade, delay);
  }

  return executeTrade();
}

async function startSequentially() {
  for (const account of config.accounts) {
    await startBotForAccount(account);
    console.log("⏳ Menunggu 5 detik sebelum akun berikutnya...");
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Jeda 5 detik sebelum akun berikutnya
  }
}

startSequentially();
