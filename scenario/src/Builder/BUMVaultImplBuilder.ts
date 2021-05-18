import { Event } from '../Event';
import { addAction, World } from '../World';
import { BUMVaultImpl } from '../Contract/BUMVaultImpl';
import { Invokation, invoke } from '../Invokation';
import { getAddressV, getExpNumberV, getNumberV, getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const BUMVaultScenarioContract = getTestContract('BUMVaultScenario');
const BUMVaultContract = getContract('BUMVault');

const BUMVaultBorkedContract = getTestContract('BUMVaultBorked');

export interface BUMVaultImplData {
  invokation: Invokation<BUMVaultImpl>;
  name: string;
  contract: string;
  description: string;
}

export async function buildBUMVaultImpl(
  world: World,
  from: string,
  event: Event
): Promise<{ world: World; bumvaultImpl: BUMVaultImpl; bumvaultImplData: BUMVaultImplData }> {
  const fetchers = [

    new Fetcher<{ name: StringV }, BUMVaultImplData>(
      `
        #### Scenario

        * "Scenario name:<String>" - The BUMVault Scenario for local testing
          * E.g. "BUMVaultImpl Deploy Scenario MyScen"
      `,
      'Scenario',
      [new Arg('name', getStringV)],
      async (world, { name }) => ({
        invokation: await BUMVaultScenarioContract.deploy<BUMVaultImpl>(world, from, []),
        name: name.val,
        contract: 'BUMVaultScenario',
        description: 'Scenario BUMVault Impl'
      })
    ),

    new Fetcher<{ name: StringV }, BUMVaultImplData>(
      `
        #### Standard

        * "Standard name:<String>" - The standard BUMVault contract
          * E.g. "BUMVaultImpl Deploy Standard MyStandard"
      `,
      'Standard',
      [new Arg('name', getStringV)],
      async (world, { name }) => {
        return {
          invokation: await BUMVaultContract.deploy<BUMVaultImpl>(world, from, []),
          name: name.val,
          contract: 'BUMVault',
          description: 'Standard BUMVault Impl'
        };
      }
    ),

    new Fetcher<{ name: StringV }, BUMVaultImplData>(
      `
        #### Borked

        * "Borked name:<String>" - A Borked BUMVault for testing
          * E.g. "BUMVaultImpl Deploy Borked MyBork"
      `,
      'Borked',
      [new Arg('name', getStringV)],
      async (world, { name }) => ({
        invokation: await BUMVaultBorkedContract.deploy<BUMVaultImpl>(world, from, []),
        name: name.val,
        contract: 'BUMVaultBorked',
        description: 'Borked BUMVault Impl'
      })
    ),
    new Fetcher<{ name: StringV }, BUMVaultImplData>(
      `
        #### Default

        * "name:<String>" - The standard BUMVault contract
          * E.g. "BUMVaultImpl Deploy MyDefault"
      `,
      'Default',
      [new Arg('name', getStringV)],
      async (world, { name }) => {
        if (world.isLocalNetwork()) {
          // Note: we're going to use the scenario contract as the standard deployment on local networks
          return {
            invokation: await BUMVaultScenarioContract.deploy<BUMVaultImpl>(world, from, []),
            name: name.val,
            contract: 'BUMVaultScenario',
            description: 'Scenario BUMVault Impl'
          };
        } else {
          return {
            invokation: await BUMVaultContract.deploy<BUMVaultImpl>(world, from, []),
            name: name.val,
            contract: 'BUMVault',
            description: 'Standard BUMVault Impl'
          };
        }
      },
      { catchall: true }
    )
  ];

  let bumvaultImplData = await getFetcherValue<any, BUMVaultImplData>(
    'DeployBUMVaultImpl',
    fetchers,
    world,
    event
  );
  let invokation = bumvaultImplData.invokation;
  delete bumvaultImplData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const bumvaultImpl = invokation.value!;

  world = await storeAndSaveContract(world, bumvaultImpl, bumvaultImplData.name, invokation, [
    {
      index: ['BUMVault', bumvaultImplData.name],
      data: {
        address: bumvaultImpl._address,
        contract: bumvaultImplData.contract,
        description: bumvaultImplData.description
      }
    }
  ]);

  return { world, bumvaultImpl, bumvaultImplData };
}
