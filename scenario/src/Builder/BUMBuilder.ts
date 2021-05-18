import { Event } from '../Event';
import { World, addAction } from '../World';
import { BUM, BUMScenario } from '../Contract/BUM';
import { Invokation } from '../Invokation';
import {  getNumberV } from '../CoreValue';
import {  NumberV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const BUMContract = getContract('BUM');
const BUMScenarioContract = getContract('BUMScenario');

export interface TokenData {
  invokation: Invokation<BUM>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildBUM(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; bum: BUM; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ chainId: NumberV }, TokenData>(
      `
      #### Scenario

      * "BUM Deploy Scenario chainId:<Number>" - Deploys Scenario BUM Token
        * E.g. "BUM Deploy Scenario 56"
    `,
      'Scenario',
      [
        new Arg("chainId", getNumberV),
      ],
      async (world, { chainId }) => {
        return {
          invokation: await BUMScenarioContract.deploy<BUMScenario>(world, from, [chainId.val]),
          contract: 'BUMScenario',
          symbol: 'BUM',
          name: 'BUM Stablecoin',
          decimals: 18
        };
      }
    ),

    new Fetcher<{}, TokenData>(
      `
      #### BUM

      * "BUM Deploy bsctestnet" - Deploys BUM Token
        * E.g. "BUM Deploy bsctestnet"
    `,
      'BUM',
      [
        // new Arg("chainId", getNumberV),
      ],
      async (world, { }) => {
        // bscmainnet
        // const chainId = 56;
        // bsctestnet
        // const chainId = 97;
        // kovan
        // const chainId = 42;
        // matic
        const chainId = 137;
        
        if (world.isLocalNetwork()) {
          return {
            invokation: await BUMScenarioContract.deploy<BUMScenario>(world, from, [chainId]),
            contract: 'BUMScenario',
            symbol: 'BUM',
            name: 'BUM Stablecoin',
            decimals: 18
          };
        } else {
          return {
            invokation: await BUMContract.deploy<BUM>(world, from, [chainId]),
            contract: 'BUM',
            symbol: 'BUM',
            name: 'BUM Stablecoin',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployBUM", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const bum = invokation.value!;
  tokenData.address = bum._address;

  world = await storeAndSaveContract(
    world,
    bum,
    'BUM',
    invokation,
    [
      { index: ['BUM'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, bum, tokenData };
}
