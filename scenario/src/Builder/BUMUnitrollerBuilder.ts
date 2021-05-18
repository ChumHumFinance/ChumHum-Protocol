import {Event} from '../Event';
import {addAction, World} from '../World';
import {BUMUnitroller} from '../Contract/BUMUnitroller';
import {Invokation} from '../Invokation';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract} from '../Contract';

const BUMUnitrollerContract = getContract("BUMUnitroller");

export interface BUMUnitrollerData {
  invokation: Invokation<BUMUnitroller>,
  description: string,
  address?: string
}

export async function buildBUMUnitroller(world: World, from: string, event: Event): Promise<{world: World, bumunitroller: BUMUnitroller, bumunitrollerData: BUMUnitrollerData}> {
  const fetchers = [
    new Fetcher<{}, BUMUnitrollerData>(`
        #### BUMUnitroller

        * "" - The Upgradable Comptroller
          * E.g. "BUMUnitroller Deploy"
      `,
      "BUMUnitroller",
      [],
      async (world, {}) => {
        return {
          invokation: await BUMUnitrollerContract.deploy<BUMUnitroller>(world, from, []),
          description: "BUMUnitroller"
        };
      },
      {catchall: true}
    )
  ];

  let bumunitrollerData = await getFetcherValue<any, BUMUnitrollerData>("DeployBUMUnitroller", fetchers, world, event);
  let invokation = bumunitrollerData.invokation;
  delete bumunitrollerData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const bumunitroller = invokation.value!;
  bumunitrollerData.address = bumunitroller._address;

  world = await storeAndSaveContract(
    world,
    bumunitroller,
    'BUMUnitroller',
    invokation,
    [
      { index: ['BUMUnitroller'], data: bumunitrollerData }
    ]
  );

  return {world, bumunitroller, bumunitrollerData};
}
