require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URLS = [
  "https://testnet-rpc.monorail.xyz",
  "https://testnet-rpc.monad.xyz",
  "https://monad-testnet.drpc.org",
  "https://10143.rpc.thirdweb.com",
];
const WMON_CONTRACT = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx";

class IzumiBot {
  constructor(config) {
    this.privateKey = config.privateKey;
    this.amount = ethers.utils.parseEther(config.amount);
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

  async wrapMON(wallet, contract) {
    try {
      console.log(
        `🔄 Wrapping ${ethers.utils.formatEther(this.amount)} MON > WMON`
      );
      const tx = await contract.deposit({
        value: this.amount,
        gasLimit: 500000,
      });
      console.log(`✅ Wrap successful ➡️  ${EXPLORER_URL}/${tx.hash}`);
      await tx.wait();
    } catch (error) {
      console.error(`❌ Error wrapping MON:`, error);
    }
  }

  async unwrapMON(wallet, contract) {
    try {
      console.log(
        `🔄 Unwrapping ${ethers.utils.formatEther(this.amount)} WMON > MON`
      );
      const tx = await contract.withdraw(this.amount, { gasLimit: 500000 });
      console.log(`✅ Unwrap successful ➡️  ${EXPLORER_URL}/${tx.hash}`);
      await tx.wait();
    } catch (error) {
      console.error(`❌ Error unwrapping MON:`, error);
    }
  }

  async run() {
    const provider = await this.connectToRpc();
    const wallet = new ethers.Wallet(this.privateKey, provider);
    const contract = new ethers.Contract(
      WMON_CONTRACT,
      [
        "function deposit() public payable",
        "function withdraw(uint256 amount) public",
      ],
      wallet
    );
    console.log(`🧧 Using wallet: ${wallet.address}`);

    await this.wrapMON(wallet, contract);
    await this.unwrapMON(wallet, contract);
    console.log(`✅ Finished Wrap/Unwrap Cycle`);
  }
}

module.exports = IzumiBot;
