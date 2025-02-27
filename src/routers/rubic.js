const { ethers } = require("ethers");

const RPC_URLS = [
  "https://testnet-rpc.monorail.xyz",
  "https://testnet-rpc.monad.xyz",
  "https://monad-testnet.drpc.org",
  "https://10143.rpc.thirdweb.com",
];
const WMON_CONTRACT = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";

const ABI_WMON = [
  "function withdraw(uint256 wad) public",
  "function balanceOf(address owner) external view returns (uint256)",
];

class RubicBot {
  constructor(config) {
    this.amount = ethers.utils.parseEther(config.amount.toString()); // Konversi ke wei
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

  async getBalance(wallet) {
    return await wallet.getBalance();
  }

  async getWmonBalance(wallet) {
    const contract = new ethers.Contract(WMON_CONTRACT, ABI_WMON, wallet);
    return await contract.balanceOf(wallet.address);
  }

  async wrapMON(wallet) {
    if (this.amount.lte(ethers.constants.Zero)) {
      console.error("❌ Invalid amount: must be greater than zero.");
      return;
    }

    const balance = await this.getBalance(wallet);

    console.log(
      `💰 Current MON balance: ${ethers.utils.formatEther(balance)} MON`
    );

    if (balance.lt(this.amount)) {
      console.error("❌ Not enough MON to wrap!");
      return;
    }

    try {
      console.log(`🔄 Wrapping ${ethers.utils.formatEther(this.amount)} MON`);

      // Buat instance kontrak WMON
      const contract = new ethers.Contract(
        WMON_CONTRACT,
        ["function deposit() public payable"], // ABI untuk deposit
        wallet
      );

      // Kirim transaksi dengan method deposit()
      const tx = await contract.deposit({
        value: this.amount,
        gasLimit: 500000, // Gunakan batas gas tetap
      });

      console.log(`➡️ Tx Hash: ${tx.hash}`);
      await tx.wait();
      console.log("✅ Wrap successful!");
    } catch (error) {
      console.error(`❌ Wrap MON failed: ${error.message}`);
    }
  }

  async unwrapMON(wallet) {
    try {
      const contract = new ethers.Contract(WMON_CONTRACT, ABI_WMON, wallet);
      const balance = await this.getWmonBalance(wallet);

      console.log(
        `💰 Current WMON balance: ${ethers.utils.formatEther(balance)} WMON`
      );

      if (balance.lt(this.amount)) {
        console.error("❌ Not enough WMON to withdraw!");
        return;
      }

      console.log(
        `🔄 Unwrapping ${ethers.utils.formatEther(this.amount)} WMON`
      );
      const tx = await contract.withdraw(this.amount);
      console.log(`➡️ Tx Hash: ${tx.hash}`);
      await tx.wait();
      console.log("✅ Unwrap successful!");
    } catch (error) {
      console.error(`❌ Unwrap WMON failed: ${error.message}`);
    }
  }

  async run() {
    const provider = await this.connectToRpc();
    const wallet = new ethers.Wallet(this.privateKey, provider);
    console.log(`🧧 Using wallet: ${wallet.address}`);

    await this.wrapMON(wallet);
    console.log(`⏳ Waiting before unwrapping...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await this.unwrapMON(wallet);
  }
}

module.exports = RubicBot;
