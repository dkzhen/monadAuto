const { ethers } = require("ethers");

const RPC_URLS = [
  "https://testnet-rpc.monorail.xyz",
  "https://testnet-rpc.monad.xyz",
  "https://monad-testnet.drpc.org",
  "https://10143.rpc.thirdweb.com",
];
const UNISWAP_V2_ROUTER_ADDRESS = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";
const WETH_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const TOKEN_ADDRESSES = [
  "0x0f0bdebf0f83cd1ee3974779bcb7315f9808c714", // DAC
  "0x88b8e2161dedc77ef4ab7585569d2415a1c1055d", // USDT
  "0x836047a99e11f376522b447bffb6e3495dd0637c", // WETH
  "0x989d38aeed8408452f0273c7d4a17fef20878e62", // MUK
  "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea", // USDC
  "0xE0590015A873bF326bd645c3E1266d4db41C4E6B", // CHOG
];

class UniswapBot {
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

  getRandomToken() {
    return TOKEN_ADDRESSES[Math.floor(Math.random() * TOKEN_ADDRESSES.length)];
  }

  async getTokenBalance(wallet, tokenAddress) {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        {
          constant: true,
          inputs: [{ name: "_owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "balance", type: "uint256" }],
          type: "function",
        },
      ],
      wallet
    );

    return await tokenContract.balanceOf(wallet.address);
  }

  async approveToken(wallet, tokenAddress, amount) {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        {
          constant: false,
          inputs: [
            { name: "_spender", type: "address" },
            { name: "_value", type: "uint256" },
          ],
          name: "approve",
          outputs: [{ name: "", type: "bool" }],
          type: "function",
        },
      ],
      wallet
    );

    console.log(
      `🔄 Approving ${ethers.utils.formatEther(amount)} tokens for swap...`
    );
    const tx = await tokenContract.approve(UNISWAP_V2_ROUTER_ADDRESS, amount);
    await tx.wait();
    console.log("✅ Approval successful");
  }

  async swap(wallet, fromToken, toToken, amount) {
    const router = new ethers.Contract(
      UNISWAP_V2_ROUTER_ADDRESS,
      [
        {
          name: "swapExactETHForTokens",
          type: "function",
          stateMutability: "payable",
          inputs: [
            { internalType: "uint256", name: "amountOutMin", type: "uint256" },
            { internalType: "address[]", name: "path", type: "address[]" },
            { internalType: "address", name: "to", type: "address" },
            { internalType: "uint256", name: "deadline", type: "uint256" },
          ],
        },
        {
          name: "swapExactTokensForETH",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { internalType: "uint256", name: "amountIn", type: "uint256" },
            { internalType: "uint256", name: "amountOutMin", type: "uint256" },
            { internalType: "address[]", name: "path", type: "address[]" },
            { internalType: "address", name: "to", type: "address" },
            { internalType: "uint256", name: "deadline", type: "uint256" },
          ],
        },
      ],
      wallet
    );

    try {
      if (fromToken === WETH_ADDRESS) {
        console.log(
          `🔄 Swapping ${ethers.utils.formatEther(amount)} ETH for tokens`
        );
        const tx = await router.swapExactETHForTokens(
          0,
          [fromToken, toToken],
          wallet.address,
          Math.floor(Date.now() / 1000) + 60 * 10,
          { value: amount, gasLimit: 210000 }
        );
        console.log(`➡️ Tx Hash: ${tx.hash}`);
        return tx;
      } else {
        const tokenBalance = await this.getTokenBalance(wallet, fromToken);
        if (tokenBalance.eq(0)) {
          console.log("❌ No token balance, skipping swap");
          return;
        }

        await this.approveToken(wallet, fromToken, tokenBalance);
        console.log(`🔄 Swapping all tokens for ETH`);
        const tx = await router.swapExactTokensForETH(
          tokenBalance,
          0,
          [fromToken, WETH_ADDRESS],
          wallet.address,
          Math.floor(Date.now() / 1000) + 60 * 10,
          { gasLimit: 210000 }
        );
        console.log(`➡️ Tx Hash: ${tx.hash}`);
        return tx;
      }
    } catch (error) {
      console.error(`❌ Swap failed: ${error.message}`);
    }
  }

  async run() {
    const provider = await this.connectToRpc();
    const wallet = new ethers.Wallet(this.privateKey, provider);
    console.log(`🧧 Using wallet: ${wallet.address}`);

    const token = this.getRandomToken();
    await this.swap(wallet, WETH_ADDRESS, token, this.amount);
    console.log(`⏳ Waiting before reversing swap...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await this.swap(wallet, token, WETH_ADDRESS, this.amount);
  }
}

module.exports = UniswapBot;
