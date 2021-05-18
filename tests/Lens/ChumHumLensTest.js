const {
  address,
  encodeParameters,
} = require('../Utils/BSC');
const {
  makeComptroller,
  makeCToken,
} = require('../Utils/ChumHum');

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

describe('ChumHumLens', () => {
  let ChumHumLens;
  let acct;

  beforeEach(async () => {
    ChumHumLens = await deploy('ChumHumLens');
    acct = accounts[0];
  });

  describe('cTokenMetadata', () => {
    it('is correct for a cErc20', async () => {
      let cErc20 = await makeCToken();
      expect(
        cullTuple(await call(ChumHumLens, 'cTokenMetadata', [cErc20._address]))
      ).toEqual(
        {
          cToken: cErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(cErc20, 'underlying', []),
          cTokenDecimals: "8",
          underlyingDecimals: "18"
        }
      );
    });

    it('is correct for cMatic', async () => {
      let cMatic = await makeCToken({kind: 'cmatic'});
      expect(
        cullTuple(await call(ChumHumLens, 'cTokenMetadata', [cMatic._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        cToken: cMatic._address,
        cTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
      });
    });
  });

  describe('cTokenMetadataAll', () => {
    it('is correct for a cErc20 and cMatic', async () => {
      let cErc20 = await makeCToken();
      let cMatic = await makeCToken({kind: 'cmatic'});
      expect(
        (await call(ChumHumLens, 'cTokenMetadataAll', [[cErc20._address, cMatic._address]])).map(cullTuple)
      ).toEqual([
        {
          cToken: cErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(cErc20, 'underlying', []),
          cTokenDecimals: "8",
          underlyingDecimals: "18"
        },
        {
          borrowRatePerBlock: "0",
          cToken: cMatic._address,
          cTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
        }
      ]);
    });
  });

  describe('cTokenBalances', () => {
    it('is correct for cERC20', async () => {
      let cErc20 = await makeCToken();
      expect(
        cullTuple(await call(ChumHumLens, 'cTokenBalances', [cErc20._address, acct]))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          cToken: cErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        }
      );
    });

    it('is correct for cMATIC', async () => {
      let cMatic = await makeCToken({kind: 'cmatic'});
      let maticBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(ChumHumLens, 'cTokenBalances', [cMatic._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          cToken: cMatic._address,
          tokenAllowance: maticBalance,
          tokenBalance: maticBalance,
        }
      );
    });
  });

  describe('cTokenBalancesAll', () => {
    it('is correct for cMatic and cErc20', async () => {
      let cErc20 = await makeCToken();
      let cMatic = await makeCToken({kind: 'cmatic'});
      let maticBalance = await web3.eth.getBalance(acct);
      
      expect(
        (await call(ChumHumLens, 'cTokenBalancesAll', [[cErc20._address, cMatic._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          cToken: cErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          cToken: cMatic._address,
          tokenAllowance: maticBalance,
          tokenBalance: maticBalance,
        }
      ]);
    })
  });

  describe('cTokenUnderlyingPrice', () => {
    it('gets correct price for cErc20', async () => {
      let cErc20 = await makeCToken();
      expect(
        cullTuple(await call(ChumHumLens, 'cTokenUnderlyingPrice', [cErc20._address]))
      ).toEqual(
        {
          cToken: cErc20._address,
          underlyingPrice: "0",
        }
      );
    });

    it('gets correct price for cMatic', async () => {
      let cMatic = await makeCToken({kind: 'cmatic'});
      expect(
        cullTuple(await call(ChumHumLens, 'cTokenUnderlyingPrice', [cMatic._address]))
      ).toEqual(
        {
          cToken: cMatic._address,
          underlyingPrice: "1000000000000000000",
        }
      );
    });
  });

  describe('cTokenUnderlyingPriceAll', () => {
    it('gets correct price for both', async () => {
      let cErc20 = await makeCToken();
      let cMatic = await makeCToken({kind: 'cmatic'});
      expect(
        (await call(ChumHumLens, 'cTokenUnderlyingPriceAll', [[cErc20._address, cMatic._address]])).map(cullTuple)
      ).toEqual([
        {
          cToken: cErc20._address,
          underlyingPrice: "0",
        },
        {
          cToken: cMatic._address,
          underlyingPrice: "1000000000000000000",
        }
      ]);
    });
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let comptroller = await makeComptroller();

      expect(
        cullTuple(await call(ChumHumLens, 'getAccountLimits', [comptroller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });

  describe('governance', () => {
    let chum, gov;
    let targets, values, signatures, callDatas;
    let proposalBlock, proposalId;
    let votingDelay;
    let votingPeriod;

    beforeEach(async () => {
      chum = await deploy('CHUM', [acct]);
      gov = await deploy('GovernorAlpha', [address(0), chum._address, address(0)]);
      targets = [acct];
      values = ["0"];
      signatures = ["getBalanceOf(address)"];
      callDatas = [encodeParameters(['address'], [acct])];
      await send(chum, 'delegate', [acct]);
      await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"]);
      proposalBlock = +(await web3.eth.getBlockNumber());
      proposalId = await call(gov, 'latestProposalIds', [acct]);
      votingDelay = Number(await call(gov, 'votingDelay'));
      votingPeriod = Number(await call(gov, 'votingPeriod'));
    });

    describe('getGovReceipts', () => {
      it('gets correct values', async () => {
        expect(
          (await call(ChumHumLens, 'getGovReceipts', [gov._address, acct, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            hasVoted: false,
            proposalId: proposalId,
            support: false,
            votes: "0",
          }
        ]);
      })
    });

    describe('getGovProposals', () => {
      it('gets correct values', async () => {
        expect(
          (await call(ChumHumLens, 'getGovProposals', [gov._address, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            againstVotes: "0",
            calldatas: callDatas,
            canceled: false,
            endBlock: (Number(proposalBlock) + votingDelay + votingPeriod).toString(),
            eta: "0",
            executed: false,
            forVotes: "0",
            proposalId: proposalId,
            proposer: acct,
            signatures: signatures,
            startBlock: (Number(proposalBlock) + votingDelay).toString(),
            targets: targets
          }
        ]);
      })
    });
  });

  describe('chum', () => {
    let chum, currentBlock;

    beforeEach(async () => {
      currentBlock = +(await web3.eth.getBlockNumber());
      chum = await deploy('CHUM', [acct]);
    });

    describe('getCHUMBalanceMetadata', () => {
      it('gets correct values', async () => {
        expect(
          cullTuple(await call(ChumHumLens, 'getCHUMBalanceMetadata', [chum._address, acct]))
        ).toEqual({
          balance: "122500000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
        });
      });
    });

    describe('getCHUMBalanceMetadataExt', () => {
      it('gets correct values', async () => {
        let comptroller = await makeComptroller();
        await send(comptroller, 'setChumHumAccrued', [acct, 5]); // harness only

        expect(
          cullTuple(await call(ChumHumLens, 'getCHUMBalanceMetadataExt', [chum._address, comptroller._address, acct]))
        ).toEqual({
          balance: "122500000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
          allocated: "5"
        });
      });
    });

    describe('getChumHumVotes', () => {
      it('gets correct values', async () => {
        expect(
          (await call(ChumHumLens, 'getChumHumVotes', [chum._address, acct, [currentBlock, currentBlock - 1]])).map(cullTuple)
        ).toEqual([
          {
            blockNumber: currentBlock.toString(),
            votes: "0",
          },
          {
            blockNumber: (Number(currentBlock) - 1).toString(),
            votes: "0",
          }
        ]);
      });

      it('reverts on future value', async () => {
        await expect(
          call(ChumHumLens, 'getChumHumVotes', [chum._address, acct, [currentBlock + 1]])
        ).rejects.toRevert('revert CHUM::getPriorVotes: not yet determined')
      });
    });
  });
});
