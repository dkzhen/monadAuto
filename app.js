const fs = require("fs");
const { ethers } = require("ethers");
const UniswapBot = require("./src/routers/uniswap");
const AprioriBot = require("./src/routers/apriori");
const RubicBot = require("./src/routers/rubic");
const IzumiBot = require("./src/routers/izumi");

const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
const bots = [UniswapBot, AprioriBot, RubicBot, IzumiBot];
const MIN_BALANCE_MON = ethers.utils.parseEther("0.05");
const RPC_URL = "https://testnet-rpc.monorail.xyz";
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

const transactionCount = {};
config.accounts.forEach((account) => {
  transactionCount[account.privateKey] = { maxTx: account.maxTx || 25 };
  bots.forEach((Bot) => {
    transactionCount[account.privateKey][Bot.name] = 0;
  });
});

function getRandomAmount() {
  return (Math.random() * (0.01 - 0.001) + 0.001).toFixed(6); // Acak antara 0.001 - 0.01 MON
}

async function getMonBalance(wallet) {
  return await provider.getBalance(wallet.address);
}

async function startBotForAccount(account) {
  const wallet = new ethers.Wallet(account.privateKey, provider);
  const balance = await getMonBalance(wallet);

  if (balance.lt(MIN_BALANCE_MON)) {
    console.log(
      `🛑 Akun ${wallet.address} saldo MON kurang dari 0.05, dilewati.`
    );
    return;
  }

  async function executeTrade() {
    if (
      bots.every(
        (Bot) =>
          transactionCount[account.privateKey][Bot.name] >=
          transactionCount[account.privateKey].maxTx
      )
    ) {
      console.log(`🛑 Akun ${wallet.address} mencapai batas transaksi.`);
      return;
    }

    const amount = ethers.utils.parseEther(getRandomAmount());
    const availableBots = bots.filter(
      (Bot) =>
        transactionCount[account.privateKey][Bot.name] <
        transactionCount[account.privateKey].maxTx
    );
    const Bot = availableBots[Math.floor(Math.random() * availableBots.length)];

    console.log(
      `💰 Menjalankan ${Bot.name} untuk ${
        wallet.address
      } dengan ${ethers.utils.formatEther(amount)} MON`
    );
    await new Bot({
      amount: getRandomAmount(),
      privateKey: account.privateKey,
    }).run();
    transactionCount[account.privateKey][Bot.name]++;

    // Menghitung delay random berdasarkan interval akun
    const delay =
      (Math.random() * (account.intervalMax - account.intervalMin) +
        account.intervalMin) *
      60 *
      1000;
    console.log(
      `🕒 Akun ${wallet.address} akan menjalankan bot lagi dalam ${(
        delay / 60000
      ).toFixed(2)} menit`
    );

    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  await executeTrade();
}

async function startSequentially() {
  for (const account of config.accounts) {
    await startBotForAccount(account);

    // Ambil delay random dari interval akun sebelum lanjut ke akun berikutnya
    const nextDelay =
      (Math.random() * (account.intervalMax - account.intervalMin) +
        account.intervalMin) *
      60 *
      1000;
    console.log(
      `⏳ Menunggu ${(nextDelay / 60000).toFixed(
        2
      )} menit sebelum akun berikutnya...`
    );

    await new Promise((resolve) => setTimeout(resolve, nextDelay));
  }
}

startSequentially();
