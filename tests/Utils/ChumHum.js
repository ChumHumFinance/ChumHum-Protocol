"use strict";

const { dfn } = require('./JS');
const {
  encodeParameters,
  maticBalance,
  maticMantissa,
  maticUnsigned,
  mergeInterface
} = require('./BSC');

async function makeComptroller(opts = {}) {
  const {
    root = saddle.account,
    treasuryGuardian = saddle.accounts[4],
    treasuryAddress = saddle.accounts[4],
    kind = 'unitroller'
  } = opts || {};

  if (kind == 'bool') {
    const comptroller = await deploy('BoolComptroller');
    const chum = opts.chum || await deploy('CHUM', [opts.chumhumOwner || root]);
    const bum = opts.bum || await makeBUM();

    const bumunitroller = await deploy('BUMUnitroller');
    const bumcontroller = await deploy('BUMControllerHarness');
    
    await send(bumunitroller, '_setPendingImplementation', [bumcontroller._address]);
    await send(bumcontroller, '_become', [bumunitroller._address]);
    mergeInterface(bumunitroller, bumcontroller);

    await send(bumunitroller, '_setComptroller', [comptroller._address]);
    await send(bumunitroller, 'setBUMAddress', [bum._address]);
    await send(bumunitroller, 'initialize');
    await send(bum, 'rely', [bumunitroller._address]);

    //await send(unitroller, '_setTreasuryData', [treasuryGuardian, treasuryAddress, 1e14]);

    return Object.assign(comptroller, { chum, bum, bumcontroller: bumunitroller });
  }

  if (kind == 'boolFee') {
    const comptroller = await deploy('BoolComptroller');
    await send(comptroller, 'setTreasuryData', [treasuryGuardian, treasuryAddress, 1e14]);
    return comptroller;
  }

  if (kind == 'false-marker') {
    return await deploy('FalseMarkerMethodComptroller');
  }

  if (kind == 'v1-no-proxy') {
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = maticMantissa(dfn(opts.closeFactor, .051));

    await send(comptroller, '_setCloseFactor', [closeFactor]);
    await send(comptroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(comptroller, { priceOracle });
  }

  if (kind == 'unitroller-g2') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG2');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = maticMantissa(dfn(opts.closeFactor, .051));
    const liquidationIncentive = maticMantissa(1);
    const chum = opts.chum || await deploy('CHUM', [opts.compOwner || root]);
    const chumhumRate = maticUnsigned(dfn(opts.chumhumRate, 1e18));

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'harnessSetChumHumRate', [chumhumRate]);
    await send(unitroller, 'setCHUMAddress', [chum._address]); // harness only

    return Object.assign(unitroller, { priceOracle, chum });
  }

  if (kind == 'unitroller') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = maticMantissa(dfn(opts.closeFactor, .051));
    const liquidationIncentive = maticMantissa(1);
    const chum = opts.chum || await deploy('CHUM', [opts.chumhumOwner || root]);
    const bum = opts.bum || await makeBUM();
    const chumhumRate = maticUnsigned(dfn(opts.chumhumRate, 1e18));
    const chumhumBUMRate = maticUnsigned(dfn(opts.chumhumBUMRate, 5e17));
    const chumhumMarkets = opts.chumhumMarkets || [];

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);

    const bumunitroller = await deploy('BUMUnitroller');
    const bumcontroller = await deploy('BUMControllerHarness');
    
    await send(bumunitroller, '_setPendingImplementation', [bumcontroller._address]);
    await send(bumcontroller, '_become', [bumunitroller._address]);
    mergeInterface(bumunitroller, bumcontroller);

    await send(unitroller, '_setBUMController', [bumunitroller._address]);
    await send(bumunitroller, '_setComptroller', [unitroller._address]);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'setCHUMAddress', [chum._address]); // harness only
    await send(bumunitroller, 'setBUMAddress', [bum._address]); // harness only
    await send(unitroller, 'harnessSetChumHumRate', [chumhumRate]);
    await send(unitroller, '_setChumHumBUMRate', [chumhumBUMRate]);
    await send(bumunitroller, '_initializeChumHumBUMState', [0]);
    await send(bumunitroller, 'initialize');
    await send(bum, 'rely', [bumunitroller._address]);

    await send(unitroller, '_setTreasuryData', [treasuryGuardian, treasuryAddress, 1e14]);

    return Object.assign(unitroller, { priceOracle, chum, bum, bumunitroller });
  }
}

async function makeCToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'cERC20'
  } = opts || {};

  const comptroller = opts.comptroller || await makeComptroller(opts.comptrollerOpts);
  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  const exchangeRate = maticMantissa(dfn(opts.exchangeRate, 1));
  const decimals = maticUnsigned(dfn(opts.decimals, 8));
  const symbol = opts.symbol || (kind === 'cmatic' ? 'cMATIC' : 'cOMG');
  const name = opts.name || `CToken ${symbol}`;
  const admin = opts.admin || root;

  let cToken, underlying;
  let cDelegator, cDelegatee, cDaiMaker;

  switch (kind) {
    case 'cmatic':
      cToken = await deploy('CMATICHarness',
        [
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin
        ])
      break;

    case 'CDai':
      cDaiMaker  = await deploy('CDaiDelegateMakerHarness');
      underlying = cDaiMaker;
      cDelegatee = await deploy('CDaiDelegateHarness');
      cDelegator = await deploy('CErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          cDelegatee._address,
          encodeParameters(['address', 'address'], [cDaiMaker._address, cDaiMaker._address])
        ]
      );
      cToken = await saddle.getContractAt('CDaiDelegateHarness', cDelegator._address);
      break;

    case 'vchum':
      underlying = await deploy('CHUM', [opts.compHolder || root]);
      cDelegatee = await deploy('VChumLikeDelegate');
      cDelegator = await deploy('CErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          cDelegatee._address,
          "0x0"
        ]
      );
      cToken = await saddle.getContractAt('VChumLikeDelegate', cDelegator._address);
      break;

    case 'cERC20':
    default:
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      cDelegatee = await deploy('CErc20DelegateHarness');
      cDelegator = await deploy('CErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          cDelegatee._address,
          "0x0"
        ]
      );
      cToken = await saddle.getContractAt('CErc20DelegateHarness', cDelegator._address);
      break;
  }

  if (opts.supportMarket) {
    await send(comptroller, '_supportMarket', [cToken._address]);
  }

  if (opts.addChumHumMarket) {
    await send(comptroller, '_addChumHumMarket', [cToken._address]);
  }

  if (opts.underlyingPrice) {
    const price = maticMantissa(opts.underlyingPrice);
    await send(comptroller.priceOracle, 'setUnderlyingPrice', [cToken._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = maticMantissa(opts.collateralFactor);
    expect(await send(comptroller, '_setCollateralFactor', [cToken._address, factor])).toSucceed();
  }

  return Object.assign(cToken, { name, symbol, underlying, comptroller, interestRateModel });
}

async function makeBUM(opts = {}) {
  const {
    chainId = 97
  } = opts || {};

  let bum;

  bum = await deploy('BUMScenario',
    [
      chainId
    ]
  );

  return Object.assign(bum);
}

async function makeInterestRateModel(opts = {}) {
  const {
    root = saddle.account,
    kind = 'harnessed'
  } = opts || {};

  if (kind == 'harnessed') {
    const borrowRate = maticMantissa(dfn(opts.borrowRate, 0));
    return await deploy('InterestRateModelHarness', [borrowRate]);
  }

  if (kind == 'false-marker') {
    const borrowRate = maticMantissa(dfn(opts.borrowRate, 0));
    return await deploy('FalseMarkerMethodInterestRateModel', [borrowRate]);
  }

  if (kind == 'white-paper') {
    const baseRate = maticMantissa(dfn(opts.baseRate, 0));
    const multiplier = maticMantissa(dfn(opts.multiplier, 1e-18));
    return await deploy('WhitePaperInterestRateModel', [baseRate, multiplier]);
  }

  if (kind == 'jump-rate') {
    const baseRate = maticMantissa(dfn(opts.baseRate, 0));
    const multiplier = maticMantissa(dfn(opts.multiplier, 1e-18));
    const jump = maticMantissa(dfn(opts.jump, 0));
    const kink = maticMantissa(dfn(opts.kink, 0));
    return await deploy('JumpRateModel', [baseRate, multiplier, jump, kink]);
  }
}

async function makePriceOracle(opts = {}) {
  const {
    root = saddle.account,
    kind = 'simple'
  } = opts || {};

  if (kind == 'simple') {
    return await deploy('SimplePriceOracle');
  }
}

async function makeToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'erc20'
  } = opts || {};

  if (kind == 'erc20') {
    const quantity = maticUnsigned(dfn(opts.quantity, 1e25));
    const decimals = maticUnsigned(dfn(opts.decimals, 18));
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Erc20 ${symbol}`;
    return await deploy('ERC20Harness', [quantity, name, decimals, symbol]);
  }
}

async function balanceOf(token, account) {
  return maticUnsigned(await call(token, 'balanceOf', [account]));
}

async function totalSupply(token) {
  return maticUnsigned(await call(token, 'totalSupply'));
}

async function borrowSnapshot(cToken, account) {
  const { principal, interestIndex } = await call(cToken, 'harnessAccountBorrows', [account]);
  return { principal: maticUnsigned(principal), interestIndex: maticUnsigned(interestIndex) };
}

async function totalBorrows(cToken) {
  return maticUnsigned(await call(cToken, 'totalBorrows'));
}

async function totalReserves(cToken) {
  return maticUnsigned(await call(cToken, 'totalReserves'));
}

async function enterMarkets(cTokens, from) {
  return await send(cTokens[0].comptroller, 'enterMarkets', [cTokens.map(c => c._address)], { from });
}

async function fastForward(cToken, blocks = 5) {
  return await send(cToken, 'harnessFastForward', [blocks]);
}

async function setBalance(cToken, account, balance) {
  return await send(cToken, 'harnessSetBalance', [account, balance]);
}

async function setMintedBUMOf(comptroller, account, balance) {
  return await send(comptroller, 'harnessSetMintedBUMOf', [account, balance]);
}

async function setBUMBalance(bum, account, balance) {
  return await send(bum, 'harnessSetBalanceOf', [account, balance]);
}

async function setMATICBalance(cMatic, balance) {
  const current = await maticBalance(cMatic._address);
  const root = saddle.account;
  expect(await send(cMatic, 'harnessDoTransferOut', [root, current])).toSucceed();
  expect(await send(cMatic, 'harnessDoTransferIn', [root, balance], { value: balance })).toSucceed();
}

async function getBalances(cTokens, accounts) {
  const balances = {};
  for (let cToken of cTokens) {
    const cBalances = balances[cToken._address] = {};
    for (let account of accounts) {
      cBalances[account] = {
        matic: await maticBalance(account),
        cash: cToken.underlying && await balanceOf(cToken.underlying, account),
        tokens: await balanceOf(cToken, account),
        borrows: (await borrowSnapshot(cToken, account)).principal
      };
    }
    cBalances[cToken._address] = {
      matic: await maticBalance(cToken._address),
      cash: cToken.underlying && await balanceOf(cToken.underlying, cToken._address),
      tokens: await totalSupply(cToken),
      borrows: await totalBorrows(cToken),
      reserves: await totalReserves(cToken)
    };
  }
  return balances;
}

async function getBalancesWithBUM(bum, cTokens, accounts) {
  const balances = {};
  for (let cToken of cTokens) {
    const cBalances = balances[cToken._address] = {};
    const bumBalancesData = balances[bum._address] = {};
    for (let account of accounts) {
      cBalances[account] = {
        matic: await maticBalance(account),
        cash: cToken.underlying && await balanceOf(cToken.underlying, account),
        tokens: await balanceOf(cToken, account),
        borrows: (await borrowSnapshot(cToken, account)).principal
      };
      bumBalancesData[account] = {
        bum: (await balanceOf(bum, account)),
      };
    }
    cBalances[cToken._address] = {
      matic: await maticBalance(cToken._address),
      cash: cToken.underlying && await balanceOf(cToken.underlying, cToken._address),
      tokens: await totalSupply(cToken),
      borrows: await totalBorrows(cToken),
      reserves: await totalReserves(cToken),
    };
  }
  return balances;
}

async function adjustBalances(balances, deltas) {
  for (let delta of deltas) {
    let cToken, account, key, diff;
    if (delta.length == 4) {
      ([cToken, account, key, diff] = delta);
    } else {
      ([cToken, key, diff] = delta);
      account = cToken._address;
    }
    balances[cToken._address][account][key] = balances[cToken._address][account][key].add(diff);
  }
  return balances;
}

async function adjustBalancesWithBUM(balances, deltas, bum) {
  for (let delta of deltas) {
    let cToken, account, key, diff;
    if (delta[0]._address != bum._address) {
      if (delta.length == 4) {
        ([cToken, account, key, diff] = delta);
      } else {
        ([cToken, key, diff] = delta);
        account = cToken._address;
      }
      balances[cToken._address][account][key] = balances[cToken._address][account][key].add(diff);
    } else {
      [cToken, account, key, diff] = delta;
      balances[bum._address][account][key] = balances[bum._address][account][key].add(diff);
    }
  }
  return balances;
}

async function preApprove(cToken, from, amount, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(cToken.underlying, 'harnessSetBalance', [from, amount], { from })).toSucceed();
  }

  return send(cToken.underlying, 'approve', [cToken._address, amount], { from });
}

async function preApproveBUM(comptroller, bum, from, to, amount, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(bum, 'harnessSetBalanceOf', [from, amount], { from })).toSucceed();
    await send(comptroller, 'harnessSetMintedBUMOf', [from, amount]);
  }

  return send(bum, 'approve', [to, amount], { from });
}

async function quickMint(cToken, minter, mintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(cToken, 1);

  if (dfn(opts.approve, true)) {
    expect(await preApprove(cToken, minter, mintAmount, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(cToken, 'harnessSetExchangeRate', [maticMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(cToken, 'mint', [mintAmount], { from: minter });
}

async function quickMintBUM(comptroller, bum, bumMinter, bumMintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(bum, 1);

  expect(await send(bum, 'harnessSetBalanceOf', [bumMinter, bumMintAmount], { bumMinter })).toSucceed();
  expect(await send(comptroller, 'harnessSetMintedBUMs', [bumMinter, bumMintAmount], { bumMinter })).toSucceed();
  expect(await send(bum, 'harnessIncrementTotalSupply', [bumMintAmount], { bumMinter })).toSucceed();
}

async function preSupply(cToken, account, tokens, opts = {}) {
  if (dfn(opts.total, true)) {
    expect(await send(cToken, 'harnessSetTotalSupply', [tokens])).toSucceed();
  }
  return send(cToken, 'harnessSetBalance', [account, tokens]);
}

async function quickRedeem(cToken, redeemer, redeemTokens, opts = {}) {
  await fastForward(cToken, 1);

  if (dfn(opts.supply, true)) {
    expect(await preSupply(cToken, redeemer, redeemTokens, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(cToken, 'harnessSetExchangeRate', [maticMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(cToken, 'redeem', [redeemTokens], { from: redeemer });
}

async function quickRedeemUnderlying(cToken, redeemer, redeemAmount, opts = {}) {
  await fastForward(cToken, 1);

  if (dfn(opts.exchangeRate)) {
    expect(await send(cToken, 'harnessSetExchangeRate', [maticMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(cToken, 'redeemUnderlying', [redeemAmount], { from: redeemer });
}

async function setOraclePrice(cToken, price) {
  return send(cToken.comptroller.priceOracle, 'setUnderlyingPrice', [cToken._address, maticMantissa(price)]);
}

async function setOraclePriceFromMantissa(cToken, price) {
  return send(cToken.comptroller.priceOracle, 'setUnderlyingPrice', [cToken._address, price]);
}

async function setBorrowRate(cToken, rate) {
  return send(cToken.interestRateModel, 'setBorrowRate', [maticMantissa(rate)]);
}

async function getBorrowRate(interestRateModel, cash, borrows, reserves) {
  return call(interestRateModel, 'getBorrowRate', [cash, borrows, reserves].map(maticUnsigned));
}

async function getSupplyRate(interestRateModel, cash, borrows, reserves, reserveFactor) {
  return call(interestRateModel, 'getSupplyRate', [cash, borrows, reserves, reserveFactor].map(maticUnsigned));
}

async function pretendBorrow(cToken, borrower, accountIndex, marketIndex, principalRaw, blockNumber = 2e7) {
  await send(cToken, 'harnessSetTotalBorrows', [maticUnsigned(principalRaw)]);
  await send(cToken, 'harnessSetAccountBorrows', [borrower, maticUnsigned(principalRaw), maticMantissa(accountIndex)]);
  await send(cToken, 'harnessSetBorrowIndex', [maticMantissa(marketIndex)]);
  await send(cToken, 'harnessSetAccrualBlockNumber', [maticUnsigned(blockNumber)]);
  await send(cToken, 'harnessSetBlockNumber', [maticUnsigned(blockNumber)]);
}

async function pretendBUMMint(comptroller, bumcontroller, bum, bumMinter, principalRaw, totalSupply, blockNumber = 2e7) {
  await send(comptroller, 'harnessSetMintedBUMOf', [bumMinter, maticUnsigned(principalRaw)]);
  await send(bum, 'harnessIncrementTotalSupply', [maticUnsigned(principalRaw)]);
  await send(bum, 'harnessSetBalanceOf', [bumMinter, maticUnsigned(principalRaw)]);
  await send(bumcontroller, 'harnessSetBlockNumber', [maticUnsigned(blockNumber)]);
}

module.exports = {
  makeComptroller,
  makeCToken,
  makeBUM,
  makeInterestRateModel,
  makePriceOracle,
  makeToken,

  balanceOf,
  totalSupply,
  borrowSnapshot,
  totalBorrows,
  totalReserves,
  enterMarkets,
  fastForward,
  setBalance,
  setMintedBUMOf,
  setBUMBalance,
  setMATICBalance,
  getBalances,
  getBalancesWithBUM,
  adjustBalances,
  adjustBalancesWithBUM,

  preApprove,
  preApproveBUM,
  quickMint,
  quickMintBUM,

  preSupply,
  quickRedeem,
  quickRedeemUnderlying,

  setOraclePrice,
  setOraclePriceFromMantissa,
  setBorrowRate,
  getBorrowRate,
  getSupplyRate,
  pretendBorrow,
  pretendBUMMint
};
