import {Event} from '../Event';
import {addAction, World} from '../World';
import {BUMVaultProxy} from '../Contract/BUMVaultProxy';
import {Invokation} from '../Invokation';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract} from '../Contract';

const BUMVaultProxyContract = getContract("BUMVaultProxy");

export interface BUMVaultProxyData {
  invokation: Invokation<BUMVaultProxy>,
  description: string,
  address?: string
}

export async function buildBUMVaultProxy(world: World, from: string, event: Event): Promise<{world: World, bumvaultproxy: BUMVaultProxy, bumvaultproxyData: BUMVaultProxyData}> {
  const fetchers = [
    new Fetcher<{}, BUMVaultProxyData>(`
        #### BUMVaultProxy

        * "" - The Upgradable Comptroller
          * E.g. "BUMVaultProxy Deploy"
      `,
      "BUMVaultProxy",
      [],
      async (world, {}) => {
        return {
          invokation: await BUMVaultProxyContract.deploy<BUMVaultProxy>(world, from, []),
          description: "BUMVaultProxy"
        };
      },
      {catchall: true}
    )
  ];

  let bumvaultproxyData = await getFetcherValue<any, BUMVaultProxyData>("DeployBUMVaultProxy", fetchers, world, event);
  let invokation = bumvaultproxyData.invokation;
  delete bumvaultproxyData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const bumvaultproxy = invokation.value!;
  bumvaultproxyData.address = bumvaultproxy._address;

  world = await storeAndSaveContract(
    world,
    bumvaultproxy,
    'BUMVaultProxy',
    invokation,
    [
      { index: ['BUMVaultProxy'], data: bumvaultproxyData }
    ]
  );

  return {world, bumvaultproxy, bumvaultproxyData};
}
