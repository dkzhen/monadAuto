const { ethers } = require("ethers");
const axios = require("axios");

const RPC_URLS = [
  "https://testnet-rpc.monorail.xyz",
  "https://testnet-rpc.monad.xyz",
  "https://monad-testnet.drpc.org",
  "https://10143.rpc.thirdweb.com",
];
const STAKE_CONTRACT_ADDRESS = "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A";
const STAKE_API_URL = "https://stake-api.apr.io/withdrawal_requests?address=";
const GAS_LIMIT_STAKE = 500000;
const GAS_LIMIT_UNSTAKE = 800000;
const GAS_LIMIT_CLAIM = 800000;

class AprioribotStaking {
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

  async stake(wallet) {
    console.log(`🔄 Staking ${ethers.utils.formatEther(this.amount)} MON`);
    const tx = {
      to: STAKE_CONTRACT_ADDRESS,
      data:
        "0x6e553f65" +
        ethers.utils.hexZeroPad(this.amount.toHexString(), 32).slice(2) +
        ethers.utils.hexZeroPad(wallet.address, 32).slice(2),
      gasLimit: ethers.utils.hexlify(GAS_LIMIT_STAKE),
      value: this.amount,
    };
    const txResponse = await wallet.sendTransaction(tx);
    console.log(`➡️ Tx Hash: ${txResponse.hash}`);
    await txResponse.wait();
    console.log("✅ Stake successful");
  }

  async requestUnstake(wallet) {
    console.log("🔄 Requesting unstake");
    const tx = {
      to: STAKE_CONTRACT_ADDRESS,
      data:
        "0x7d41c86e" +
        ethers.utils.hexZeroPad(this.amount.toHexString(), 32).slice(2) +
        ethers.utils.hexZeroPad(wallet.address, 32).slice(2) +
        ethers.utils.hexZeroPad(wallet.address, 32).slice(2),
      gasLimit: ethers.utils.hexlify(GAS_LIMIT_UNSTAKE),
      value: ethers.utils.parseEther("0"),
    };
    const txResponse = await wallet.sendTransaction(tx);
    console.log(`➡️ Tx Hash: ${txResponse.hash}`);
    await txResponse.wait();
    console.log("✅ Unstake requested");
  }

  async fetchUnstakeStatus(wallet) {
    console.log("🔄 Checking unstake status");
    const url = `${STAKE_API_URL}${wallet.address}`;
    let claimableRequests = [];

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const response = await axios.get(url, { timeout: 10000 });
        claimableRequests = response.data.filter(
          (request) => !request.claimed && request.is_claimable
        );
        if (claimableRequests.length > 0) return claimableRequests;
      } catch (error) {
        console.error("❌ Error fetching unstake status:", error.message);
      }

      if (attempt === 0) {
        console.log("⏳ No claims available, waiting 11 minutes...");
        await new Promise((resolve) => setTimeout(resolve, 11 * 60 * 1000));
      } else {
        console.log(
          `⏳ Attempt ${attempt}/5 - Waiting 2 minutes before retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, 2 * 60 * 1000));
      }
    }
    return claimableRequests;
  }

  async claim(wallet, claimableRequests) {
    for (const request of claimableRequests) {
      console.log(`✅ Claiming withdrawal: ${request.id}`);
      const tx = {
        to: STAKE_CONTRACT_ADDRESS,
        data:
          "0x492e47d2" +
          "0000000000000000000000000000000000000000000000000000000000000040" +
          ethers.utils.hexZeroPad(wallet.address, 32).slice(2) +
          "0000000000000000000000000000000000000000000000000000000000000001" +
          ethers.utils
            .hexZeroPad(ethers.BigNumber.from(request.id).toHexString(), 32)
            .slice(2),
        gasLimit: ethers.utils.hexlify(GAS_LIMIT_CLAIM),
        value: ethers.utils.parseEther("0"),
      };
      const txResponse = await wallet.sendTransaction(tx);
      console.log(`➡️ Tx Hash: ${txResponse.hash}`);
      await txResponse.wait();
      console.log(`✅ Claim successful: ${request.id}`);
    }
  }

  async run() {
    const provider = await this.connectToRpc();
    const wallet = new ethers.Wallet(this.privateKey, provider);
    console.log(`🧧 Using wallet: ${wallet.address}`);

    await this.stake(wallet);
    await this.requestUnstake(wallet);
    const claimableRequests = await this.fetchUnstakeStatus(wallet);
    if (claimableRequests.length > 0) {
      await this.claim(wallet, claimableRequests);
    } else {
      console.log("🚫 No claimable withdrawals found after retries.");
    }
  }
}

module.exports = AprioribotStaking;
