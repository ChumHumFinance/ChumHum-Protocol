import { Event } from '../Event';
import { World, addAction } from '../World';
import { CHUM, CHUMScenario } from '../Contract/CHUM';
import { Invokation } from '../Invokation';
import { getAddressV } from '../CoreValue';
import { AddressV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const CHUMContract = getContract('CHUM');
const CHUMScenarioContract = getContract('CHUMScenario');

export interface TokenData {
  invokation: Invokation<CHUM>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildCHUM(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; chum: CHUM; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Scenario

      * "CHUM Deploy Scenario account:<Address>" - Deploys Scenario CHUM Token
        * E.g. "CHUM Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        return {
          invokation: await CHUMScenarioContract.deploy<CHUMScenario>(world, from, [account.val]),
          contract: 'CHUMScenario',
          symbol: 'CHUM',
          name: 'ChumHum Governance Token',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### CHUM

      * "CHUM Deploy account:<Address>" - Deploys CHUM Token
        * E.g. "CHUM Deploy Geoff"
    `,
      'CHUM',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await CHUMScenarioContract.deploy<CHUMScenario>(world, from, [account.val]),
            contract: 'CHUMScenario',
            symbol: 'CHUM',
            name: 'ChumHum Governance Token',
            decimals: 18
          };
        } else {
          return {
            invokation: await CHUMContract.deploy<CHUM>(world, from, [account.val]),
            contract: 'CHUM',
            symbol: 'CHUM',
            name: 'ChumHum Governance Token',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployCHUM", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const chum = invokation.value!;
  tokenData.address = chum._address;

  world = await storeAndSaveContract(
    world,
    chum,
    'CHUM',
    invokation,
    [
      { index: ['CHUM'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, chum, tokenData };
}
