import { Event } from '../Event';
import { addAction, World } from '../World';
import { BUMVaultImpl } from '../Contract/BUMVaultImpl';
import { BUMVaultProxy } from '../Contract/BUMVaultProxy';
import { invoke } from '../Invokation';
import { getEventV, getStringV } from '../CoreValue';
import { EventV, StringV } from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { buildBUMVaultImpl } from '../Builder/BUMVaultImplBuilder';
import { BUMVaultErrorReporter } from '../ErrorReporter';
import { getBUMVaultImpl, getBUMVaultImplData, getBUMVaultProxy } from '../ContractLookup';
import { verify } from '../Verify';
import { mergeContractABI } from '../Networks';

async function genBUMVaultImpl(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, bumvaultImpl, bumvaultImplData } = await buildBUMVaultImpl(
    world,
    from,
    params
  );
  world = nextWorld;

  world = addAction(
    world,
    `Added BUMVault Implementation (${bumvaultImplData.description}) at address ${bumvaultImpl._address}`,
    bumvaultImplData.invokation
  );

  return world;
}

async function mergeABI(
  world: World,
  from: string,
  bumvaultImpl: BUMVaultImpl,
  bumvaultproxy: BUMVaultProxy
): Promise<World> {
  if (!world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world = await mergeContractABI(world, 'BUMVault', bumvaultproxy, bumvaultproxy.name, bumvaultImpl.name);
  }

  return world;
}
async function become(
  world: World,
  from: string,
  bumvaultImpl: BUMVaultImpl,
  bumvaultproxy: BUMVaultProxy
): Promise<World> {
  let invokation = await invoke(
    world,
    bumvaultImpl.methods._become(bumvaultproxy._address),
    from,
    BUMVaultErrorReporter
  );

  if (!world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world = await mergeContractABI(world, 'BUMVault', bumvaultproxy, bumvaultproxy.name, bumvaultImpl.name);
  }

  world = addAction(world, `Become ${bumvaultproxy._address}'s BUMVault Impl`, invokation);

  return world;
}

async function verifyBUMVaultImpl(
  world: World,
  bumvaultImpl: BUMVaultImpl,
  name: string,
  contract: string,
  apiKey: string
): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, bumvaultImpl._address);
  }

  return world;
}

export function bumvaultImplCommands() {
  return [
    new Command<{ bumvaultImplParams: EventV }>(
      `
        #### Deploy

        * "BUMVaultImpl Deploy ...bumvaultImplParams" - Generates a new BUMVault Implementation
          * E.g. "BUMVaultImpl Deploy MyScen Scenario"
      `,
      'Deploy',
      [new Arg('bumvaultImplParams', getEventV, { variadic: true })],
      (world, from, { bumvaultImplParams }) => genBUMVaultImpl(world, from, bumvaultImplParams.val)
    ),
    new View<{ bumvaultImplArg: StringV; apiKey: StringV }>(
      `
        #### Verify

        * "BUMVaultImpl <Impl> Verify apiKey:<String>" - Verifies BUMVault Implemetation in BscScan
          * E.g. "BUMVaultImpl Verify "myApiKey"
      `,
      'Verify',
      [new Arg('bumvaultImplArg', getStringV), new Arg('apiKey', getStringV)],
      async (world, { bumvaultImplArg, apiKey }) => {
        let [bumvaultImpl, name, data] = await getBUMVaultImplData(world, bumvaultImplArg.val);

        return await verifyBUMVaultImpl(world, bumvaultImpl, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
    new Command<{
      bumvaultproxy: BUMVaultProxy;
      bumvaultImpl: BUMVaultImpl;
    }>(
      `
        #### Become

        * "BUMVaultImpl <Impl> Become" - Become the comptroller, if possible.
          * E.g. "BUMVaultImpl MyImpl Become
      `,
      'Become',
      [
        new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true }),
        new Arg('bumvaultImpl', getBUMVaultImpl)
      ],
      (world, from, { bumvaultproxy, bumvaultImpl }) => {
        return become(world, from, bumvaultImpl, bumvaultproxy)
      },
      { namePos: 1 }
    ),

    new Command<{
      bumvaultproxy: BUMVaultProxy;
      bumvaultImpl: BUMVaultImpl;
    }>(
      `
        #### MergeABI

        * "BUMVaultImpl <Impl> MergeABI" - Merges the ABI, as if it was a become.
          * E.g. "BUMVaultImpl MyImpl MergeABI
      `,
      'MergeABI',
      [
        new Arg('bumvaultproxy', getBUMVaultProxy, { implicit: true }),
        new Arg('bumvaultImpl', getBUMVaultImpl)
      ],
      (world, from, { bumvaultproxy, bumvaultImpl }) => mergeABI(world, from, bumvaultImpl, bumvaultproxy),
      { namePos: 1 }
    )
  ];
}

export async function processBUMVaultImplEvent(
  world: World,
  event: Event,
  from: string | null
): Promise<World> {
  return await processCommandEvent<any>('BUMVaultImpl', bumvaultImplCommands(), world, event, from);
}
