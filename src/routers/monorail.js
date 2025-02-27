const { ethers } = require("ethers");

const RPC_URLS = [
  "https://testnet-rpc.monorail.xyz",
  "https://testnet-rpc.monad.xyz",
  "https://monad-testnet.drpc.org",
  "https://10143.rpc.thirdweb.com",
];
const CONTRACT_ADDRESS = "0xC995498c22a012353FAE7eCC701810D673E25794";

class MonorailBot {
  constructor(config) {
    this.amount = ethers.utils.parseEther(config.amount);
    this.privateKey = config.privateKey;
  }

  async connectToRpc() {
    for (const url of RPC_URLS) {
      try {
        const provider = new ethers.providers.JsonRpcProvider(url);
        await provider.getNetwork();
        console.log(`✅ Connected to ${url}`);
        return provider;
      } catch (error) {
        console.log(`❌ Failed to connect to ${url}, trying next...`);
      }
    }
    throw new Error("❌ All RPCs failed");
  }

  async checkBalance(wallet) {
    const balance = await wallet.provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);
    if (balance.lt(this.amount)) {
      console.error("❌ Saldo tidak cukup untuk transaksi.");
      process.exit(1);
    }
  }

  async sendTransaction(wallet) {
    await this.checkBalance(wallet);
    const data = `0x96f25cbe0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000760afe86e5de5fa0ee542fc7b7b713e1c542570100000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000140000000000000000000000000${wallet.address.replace(
      /^0x/,
      ""
    )}00000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000000000000000028870ff8840000000000000000000000000000000000000000000000000000000000000001000000000000000000000000760afe86e5de5fa0ee542fc7b7b713e1c5425701000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000004d0e30db000000000000000000000000000000000000000000000000000000000`;

    try {
      console.log("🔍 Memeriksa apakah transaksi bisa dieksekusi...");
      await wallet.provider.call({ to: CONTRACT_ADDRESS, data });
      console.log("✅ Transaksi valid. Melanjutkan...");

      let gasLimit;
      try {
        gasLimit = await wallet.provider.estimateGas({
          from: wallet.address,
          to: CONTRACT_ADDRESS,
          data,
        });
      } catch (err) {
        console.warn("⚠️ Estimasi gas gagal. Menggunakan gas limit default.");
        gasLimit = ethers.utils.hexlify(500000);
      }

      const tx = {
        to: CONTRACT_ADDRESS,
        data: data,
        gasLimit: gasLimit || ethers.utils.hexlify(500000),
        value: ethers.utils.parseEther("0"),
      };

      console.log("🚀 Mengirim transaksi...");
      const txResponse = await wallet.sendTransaction(tx);
      console.log("✅ Transaksi dikirim! Menunggu konfirmasi...");
      await txResponse.wait();

      console.log("🎉 Transaksi sukses!");
      console.log(
        `🔗 Explorer: https://testnet.monadexplorer.com/tx/${txResponse.hash}`
      );
    } catch (error) {
      console.error("❌ Error terjadi:", error.message || error);
    }
  }

  async run() {
    const provider = await this.connectToRpc();
    const wallet = new ethers.Wallet(this.privateKey, provider);
    console.log(`🧧 Using wallet: ${wallet.address}`);
    await this.sendTransaction(wallet);
  }
}

module.exports = MonorailBot;
