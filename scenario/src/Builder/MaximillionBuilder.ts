import {Event} from '../Event';
import {addAction, World} from '../World';
import {Maximillion} from '../Contract/Maximillion';
import {Invokation} from '../Invokation';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract} from '../Contract';
import {getAddressV} from '../CoreValue';
import {AddressV} from '../Value';

const MaximillionContract = getContract("Maximillion");

export interface MaximillionData {
  invokation: Invokation<Maximillion>,
  description: string,
  cMaticAddress: string,
  address?: string
}

export async function buildMaximillion(world: World, from: string, event: Event): Promise<{world: World, maximillion: Maximillion, maximillionData: MaximillionData}> {
  const fetchers = [
    new Fetcher<{cMatic: AddressV}, MaximillionData>(`
        #### Maximillion

        * "" - Maximum Matic Repays Contract
          * E.g. "Maximillion Deploy"
      `,
      "Maximillion",
      [
        new Arg("cMatic", getAddressV)
      ],
      async (world, {cMatic}) => {
        return {
          invokation: await MaximillionContract.deploy<Maximillion>(world, from, [cMatic.val]),
          description: "Maximillion",
          cMaticAddress: cMatic.val
        };
      },
      {catchall: true}
    )
  ];

  let maximillionData = await getFetcherValue<any, MaximillionData>("DeployMaximillion", fetchers, world, event);
  let invokation = maximillionData.invokation;
  delete maximillionData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const maximillion = invokation.value!;
  maximillionData.address = maximillion._address;

  world = await storeAndSaveContract(
    world,
    maximillion,
    'Maximillion',
    invokation,
    [
      { index: ['Maximillion'], data: maximillionData }
    ]
  );

  return {world, maximillion, maximillionData};
}
