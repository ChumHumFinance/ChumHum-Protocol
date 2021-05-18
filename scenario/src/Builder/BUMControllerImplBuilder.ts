import { Event } from '../Event';
import { addAction, World } from '../World';
import { BUMControllerImpl } from '../Contract/BUMControllerImpl';
import { Invokation, invoke } from '../Invokation';
import { getAddressV, getExpNumberV, getNumberV, getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const BUMControllerScenarioContract = getTestContract('BUMControllerScenario');
const BUMControllerContract = getContract('BUMController');

const BUMControllerBorkedContract = getTestContract('BUMControllerBorked');

export interface BUMControllerImplData {
  invokation: Invokation<BUMControllerImpl>;
  name: string;
  contract: string;
  description: string;
}

export async function buildBUMControllerImpl(
  world: World,
  from: string,
  event: Event
): Promise<{ world: World; bumcontrollerImpl: BUMControllerImpl; bumcontrollerImplData: BUMControllerImplData }> {
  const fetchers = [

    new Fetcher<{ name: StringV }, BUMControllerImplData>(
      `
        #### Scenario

        * "Scenario name:<String>" - The BUMController Scenario for local testing
          * E.g. "BUMControllerImpl Deploy Scenario MyScen"
      `,
      'Scenario',
      [new Arg('name', getStringV)],
      async (world, { name }) => ({
        invokation: await BUMControllerScenarioContract.deploy<BUMControllerImpl>(world, from, []),
        name: name.val,
        contract: 'BUMControllerScenario',
        description: 'Scenario BUMController Impl'
      })
    ),

    new Fetcher<{ name: StringV }, BUMControllerImplData>(
      `
        #### Standard

        * "Standard name:<String>" - The standard BUMController contract
          * E.g. "BUMControllerImpl Deploy Standard MyStandard"
      `,
      'Standard',
      [new Arg('name', getStringV)],
      async (world, { name }) => {
        return {
          invokation: await BUMControllerContract.deploy<BUMControllerImpl>(world, from, []),
          name: name.val,
          contract: 'BUMController',
          description: 'Standard BUMController Impl'
        };
      }
    ),

    new Fetcher<{ name: StringV }, BUMControllerImplData>(
      `
        #### Borked

        * "Borked name:<String>" - A Borked BUMController for testing
          * E.g. "BUMControllerImpl Deploy Borked MyBork"
      `,
      'Borked',
      [new Arg('name', getStringV)],
      async (world, { name }) => ({
        invokation: await BUMControllerBorkedContract.deploy<BUMControllerImpl>(world, from, []),
        name: name.val,
        contract: 'BUMControllerBorked',
        description: 'Borked BUMController Impl'
      })
    ),
    new Fetcher<{ name: StringV }, BUMControllerImplData>(
      `
        #### Default

        * "name:<String>" - The standard BUMController contract
          * E.g. "BUMControllerImpl Deploy MyDefault"
      `,
      'Default',
      [new Arg('name', getStringV)],
      async (world, { name }) => {
        if (world.isLocalNetwork()) {
          // Note: we're going to use the scenario contract as the standard deployment on local networks
          return {
            invokation: await BUMControllerScenarioContract.deploy<BUMControllerImpl>(world, from, []),
            name: name.val,
            contract: 'BUMControllerScenario',
            description: 'Scenario BUMController Impl'
          };
        } else {
          return {
            invokation: await BUMControllerContract.deploy<BUMControllerImpl>(world, from, []),
            name: name.val,
            contract: 'BUMController',
            description: 'Standard BUMController Impl'
          };
        }
      },
      { catchall: true }
    )
  ];

  let bumcontrollerImplData = await getFetcherValue<any, BUMControllerImplData>(
    'DeployBUMControllerImpl',
    fetchers,
    world,
    event
  );
  let invokation = bumcontrollerImplData.invokation;
  delete bumcontrollerImplData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const bumcontrollerImpl = invokation.value!;

  world = await storeAndSaveContract(world, bumcontrollerImpl, bumcontrollerImplData.name, invokation, [
    {
      index: ['BUMController', bumcontrollerImplData.name],
      data: {
        address: bumcontrollerImpl._address,
        contract: bumcontrollerImplData.contract,
        description: bumcontrollerImplData.description
      }
    }
  ]);

  return { world, bumcontrollerImpl, bumcontrollerImplData };
}
