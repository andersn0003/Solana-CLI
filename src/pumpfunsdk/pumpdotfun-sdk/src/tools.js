const { AnchorProvider } = require("@coral-xyz/anchor");
const { PumpFunSDK, DEFAULT_DECIMALS } = require("./pumpfun.js");
const {
  sendTxToJito,
  DEFAULT_COMMITMENT,
  generateWalletsAndDropSOL,
  solCollector,
} = require("./util.js");
const { wallet, connection } = require("../../../helpers/config.js"); 
const {
  getOrCreateKeypair,
  getSPLBalance,
  printSOLBalance,
  printSPLBalance,
  getKeypairByJsonPath,
} = require("../example/util.js");
const fs = require("fs");
const { promises } = require("dns");
const {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const { bs58 } = require("@coral-xyz/anchor/dist/cjs/utils/bytes");
const {
  calculateWithSlippageBuy,
  sendTx,
  getOurWallet,
  getOtherTradersWallet,
  readCSVFile,
  extractPrivateKeyAndSolana,
} = require("./util.js");
const {
  jito_executeAndConfirm,
} = require("./transactions/jito-tx-executor.js");
const path = require("path");
const { get } = require("http");
const SLIPPAGE_BASIS_POINTS = 100n;

/**
 * Creates and buys a token using the provided parameters.
 * @param {string} pathToMintKeypair - The path to the mint keypair JSON file.
 * @param {object} tokenMetadata - The metadata of the token.
 * @param {number} initialBuySolAmount - The initial amount of SOL to buy the token with.
 * @returns {Promise<void>} - A promise that resolves when the token creation and purchase is complete.
 */
async function createAndBuy(pathToMintKeypair, tokenMetadata, initialBuySolAmount) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "finalized",
  });

  const sdk = new PumpFunSDK(provider);
  const mintKeypair = getKeypairByJsonPath(pathToMintKeypair);
  console.log(mintKeypair.publicKey);
  await printSOLBalance(connection, wallet.publicKey, "Master wallet keypair");
  let globalAccount = await sdk.getGlobalAccount();
  let bondingCurveAccount = await sdk.getBondingCurveAccount(
    mintKeypair.publicKey
  );
  if (!bondingCurveAccount) {
    // the mint is not exist in pump.fun yet

    let createResults = await sdk.createAndBuy(
      wallet,
      mintKeypair,
      tokenMetadata,
      BigInt(initialBuySolAmount * LAMPORTS_PER_SOL),
      SLIPPAGE_BASIS_POINTS,
      {
        unitLimit: 250000,
        unitPrice: 170000, // can be ignored if using jito tips
      }
    );
    if (createResults) {
      console.log(
        "Success:",
        `https://pump.fun/${mintKeypair.publicKey.toBase58()}`
      );
      bondingCurveAccount = await sdk.getBondingCurveAccount(
        mintKeypair.publicKey
      );
      console.log("Bonding curve after create and buy", bondingCurveAccount);
      printSPLBalance(connection, mintKeypair.publicKey, wallet.publicKey);
    }
  } else {
    console.log("boundingCurveAccount", bondingCurveAccount);
    console.log(
      "Success:",
      `https://pump.fun/${mintKeypair.publicKey.toBase58()}`
    );
    printSPLBalance(connection, mintKeypair.publicKey, wallet.publicKey);
  }
}

/**
 * Sells a specified percentage of tokens.
 * @param {string} mintPubKey - The public key of the token mint.
 * @param {number} sellPercentage - The percentage of tokens to sell.
 * @returns {Promise<void>} - A promise that resolves when the sell operation is complete.
 */
async function sell(mintPubKey, sellPercentage) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "finalized",
  });

  const sdk = new PumpFunSDK(provider);
  let currentTokenBalance = await getSPLBalance(
    connection,
    mintPubKey,
    wallet.publicKey
  );
  console.log("currentTokenBalance", currentTokenBalance);
  if (currentTokenBalance) {
    let sellResults = await sdk.sell(
      wallet,
      mintPubKey,
      BigInt(
        currentTokenBalance * Math.pow(10, DEFAULT_DECIMALS) * sellPercentage
      ),
      SLIPPAGE_BASIS_POINTS,
      {
        unitLimit: 250000,
        unitPrice: 250000,
      }
    );
    if (sellResults.success) {
      await printSPLBalance(connection, mintPubKey, wallet.publicKey);
      console.log(
        "Bonding curve after sell",
        await sdk.getBondingCurveAccount(mintPubKey)
      );
    } else {
      console.log("Sell failed");
    }
  }
}

/**
 * Buys tokens from the bonding curve.
 * @param {string} mintPubKey - The public key of the token mint.
 * @param {number} solPerOrder - The amount of SOL to spend per order.
 * @returns {Promise<void>} - A promise that resolves when the buy operation is complete.
 */
async function buy(mintPubKey, solPerOrder) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "finalized",
  });

  const sdk = new PumpFunSDK(provider);
  let buyResults = await sdk.buy(
    wallet,
    mintPubKey,
    BigInt(solPerOrder * LAMPORTS_PER_SOL),
    SLIPPAGE_BASIS_POINTS,
    {
      unitLimit: 250000,
      unitPrice: 250000,
    }
  );
  if (buyResults.success) {
    printSPLBalance(connection, mintPubKey, wallet.publicKey);
    console.log(
      "Bonding curve after buy",
      await sdk.getBondingCurveAccount(mintPubKey)
    );
  } else {
    console.log("Buy failed");
  }
}



async function run() {

  // Please change your own path
  const pathToSnipersPrivateKey =
    "/Users/chiwangso/Desktop/beta-memecoin-cli/src/pump.fun/pumpdotfun-sdk/src/WalletKeypairs/privateKeys.json";
  const pathToMintKeypair =
    "/Users/chiwangso/Desktop/beta-memecoin-cli/src/pump.fun/pump-keypair/token_address.json";
  const tokenAddress = new PublicKey(
    "token_address"
  );

  //console.log(wallet.publicKey.toBase58());
    // buy token with 0.01 SOL
   // await buy(tokenAddress, 0.01);
    // sell token with 100% of the balance
   // await sell(tokenAddress, 1);

  // bundle buy with 3 buyers, it will help to generate three wallets, 
  // if you don't have private keys in pathToSnipersPrivateKey,
  // if you have, it look for the first 3 private keys in pathToSnipersPrivateKey
  //await bundleBuys(5, pathToSnipersPrivateKey, tokenAddress, 0.005, wallet);

  // bundle sell with 3 sellers, it will look for the first 3 private keys in pathToSnipersPrivateKey
  // with 100 percentage of the balance of these mfers, use master to pay the fee
  // await bundleSells(pathToSnipersPrivateKey, tokenAddress, 3, 1, connection, wallet)


  // collet the sol from those mfers to the master wallet
  // await solCollector(connection, wallet, 6, pathToSnipersPrivateKey)

  // create the token and initial buy with 0.01 sol
  // createAndBuy(pathToMintKeypair, tokenMetadata, 0.01);



  
}

//run();

module.exports = {buy, sell, createAndBuy}