import { Event } from '../Event';
import { addAction, World } from '../World';
import { BUMControllerImpl } from '../Contract/BUMControllerImpl';
import { BUMUnitroller } from '../Contract/BUMUnitroller';
import { invoke } from '../Invokation';
import { getEventV, getStringV } from '../CoreValue';
import { EventV, StringV } from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { buildBUMControllerImpl } from '../Builder/BUMControllerImplBuilder';
import { BUMControllerErrorReporter } from '../ErrorReporter';
import { getBUMControllerImpl, getBUMControllerImplData, getBUMUnitroller } from '../ContractLookup';
import { verify } from '../Verify';
import { mergeContractABI } from '../Networks';

async function genBUMControllerImpl(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, bumcontrollerImpl, bumcontrollerImplData } = await buildBUMControllerImpl(
    world,
    from,
    params
  );
  world = nextWorld;

  world = addAction(
    world,
    `Added BUMController Implementation (${bumcontrollerImplData.description}) at address ${bumcontrollerImpl._address}`,
    bumcontrollerImplData.invokation
  );

  return world;
}

async function mergeABI(
  world: World,
  from: string,
  bumcontrollerImpl: BUMControllerImpl,
  bumunitroller: BUMUnitroller
): Promise<World> {
  if (!world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world = await mergeContractABI(world, 'BUMController', bumunitroller, bumunitroller.name, bumcontrollerImpl.name);
  }

  return world;
}

async function becomeG1(
  world: World,
  from: string,
  bumcontrollerImpl: BUMControllerImpl,
  bumunitroller: BUMUnitroller
): Promise<World> {
  let invokation = await invoke(
    world,
    bumcontrollerImpl.methods._become(bumunitroller._address),
    from,
    BUMControllerErrorReporter
  );

  if (!world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world = await mergeContractABI(world, 'BUMController', bumunitroller, bumunitroller.name, bumcontrollerImpl.name);
  }

  world = addAction(world, `Become ${bumunitroller._address}'s BUMController Impl`, invokation);

  return world;
}

async function becomeG2(
  world: World,
  from: string,
  bumcontrollerImpl: BUMControllerImpl,
  bumunitroller: BUMUnitroller
): Promise<World> {
  let invokation = await invoke(
    world,
    bumcontrollerImpl.methods._become(bumunitroller._address),
    from,
    BUMControllerErrorReporter
  );

  if (!world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world = await mergeContractABI(world, 'BUMController', bumunitroller, bumunitroller.name, bumcontrollerImpl.name);
  }

  world = addAction(world, `Become ${bumunitroller._address}'s BUMController Impl`, invokation);

  return world;
}

async function become(
  world: World,
  from: string,
  bumcontrollerImpl: BUMControllerImpl,
  bumunitroller: BUMUnitroller
): Promise<World> {
  let invokation = await invoke(
    world,
    bumcontrollerImpl.methods._become(bumunitroller._address),
    from,
    BUMControllerErrorReporter
  );

  if (!world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world = await mergeContractABI(world, 'BUMController', bumunitroller, bumunitroller.name, bumcontrollerImpl.name);
  }

  world = addAction(world, `Become ${bumunitroller._address}'s BUMController Impl`, invokation);

  return world;
}

async function verifyBUMControllerImpl(
  world: World,
  bumcontrollerImpl: BUMControllerImpl,
  name: string,
  contract: string,
  apiKey: string
): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, bumcontrollerImpl._address);
  }

  return world;
}

export function bumcontrollerImplCommands() {
  return [
    new Command<{ bumcontrollerImplParams: EventV }>(
      `
        #### Deploy

        * "BUMControllerImpl Deploy ...bumcontrollerImplParams" - Generates a new BUMController Implementation
          * E.g. "BUMControllerImpl Deploy MyScen Scenario"
      `,
      'Deploy',
      [new Arg('bumcontrollerImplParams', getEventV, { variadic: true })],
      (world, from, { bumcontrollerImplParams }) => genBUMControllerImpl(world, from, bumcontrollerImplParams.val)
    ),
    new View<{ bumcontrollerImplArg: StringV; apiKey: StringV }>(
      `
        #### Verify

        * "BUMControllerImpl <Impl> Verify apiKey:<String>" - Verifies BUMController Implemetation in BscScan
          * E.g. "BUMControllerImpl Verify "myApiKey"
      `,
      'Verify',
      [new Arg('bumcontrollerImplArg', getStringV), new Arg('apiKey', getStringV)],
      async (world, { bumcontrollerImplArg, apiKey }) => {
        let [bumcontrollerImpl, name, data] = await getBUMControllerImplData(world, bumcontrollerImplArg.val);

        return await verifyBUMControllerImpl(world, bumcontrollerImpl, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),

    new Command<{
      bumunitroller: BUMUnitroller;
      bumcontrollerImpl: BUMControllerImpl;
    }>(
      `
        #### BecomeG1
        * "BUMControllerImpl <Impl> BecomeG1" - Become the bumcontroller, if possible.
          * E.g. "BUMControllerImpl MyImpl BecomeG1
      `,
      'BecomeG1',
      [
        new Arg('bumunitroller', getBUMUnitroller, { implicit: true }),
        new Arg('bumcontrollerImpl', getBUMControllerImpl)
      ],
      (world, from, { bumunitroller, bumcontrollerImpl }) => {
        return becomeG1(world, from, bumcontrollerImpl, bumunitroller)
      },
      { namePos: 1 }
    ),

    new Command<{
      bumunitroller: BUMUnitroller;
      bumcontrollerImpl: BUMControllerImpl;
    }>(
      `
        #### BecomeG2
        * "BUMControllerImpl <Impl> BecomeG2" - Become the bumcontroller, if possible.
          * E.g. "BUMControllerImpl MyImpl BecomeG2
      `,
      'BecomeG2',
      [
        new Arg('bumunitroller', getBUMUnitroller, { implicit: true }),
        new Arg('bumcontrollerImpl', getBUMControllerImpl)
      ],
      (world, from, { bumunitroller, bumcontrollerImpl }) => {
        return becomeG2(world, from, bumcontrollerImpl, bumunitroller)
      },
      { namePos: 1 }
    ),

    new Command<{
      bumunitroller: BUMUnitroller;
      bumcontrollerImpl: BUMControllerImpl;
    }>(
      `
        #### Become

        * "BUMControllerImpl <Impl> Become" - Become the bumcontroller, if possible.
          * E.g. "BUMControllerImpl MyImpl Become
      `,
      'Become',
      [
        new Arg('bumunitroller', getBUMUnitroller, { implicit: true }),
        new Arg('bumcontrollerImpl', getBUMControllerImpl)
      ],
      (world, from, { bumunitroller, bumcontrollerImpl }) => {
        return become(world, from, bumcontrollerImpl, bumunitroller)
      },
      { namePos: 1 }
    ),

    new Command<{
      bumunitroller: BUMUnitroller;
      bumcontrollerImpl: BUMControllerImpl;
    }>(
      `
        #### MergeABI

        * "BUMControllerImpl <Impl> MergeABI" - Merges the ABI, as if it was a become.
          * E.g. "BUMControllerImpl MyImpl MergeABI
      `,
      'MergeABI',
      [
        new Arg('bumunitroller', getBUMUnitroller, { implicit: true }),
        new Arg('bumcontrollerImpl', getBUMControllerImpl)
      ],
      (world, from, { bumunitroller, bumcontrollerImpl }) => mergeABI(world, from, bumcontrollerImpl, bumunitroller),
      { namePos: 1 }
    )
  ];
}

export async function processBUMControllerImplEvent(
  world: World,
  event: Event,
  from: string | null
): Promise<World> {
  return await processCommandEvent<any>('BUMControllerImpl', bumcontrollerImplCommands(), world, event, from);
}
