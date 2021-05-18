import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {Comptroller} from '../Contract/Comptroller';
import {ComptrollerImpl} from '../Contract/ComptrollerImpl';
import {CToken} from '../Contract/CToken';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getBoolV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getPercentV,
  getStringV,
  getCoreValue
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {buildComptrollerImpl} from '../Builder/ComptrollerImplBuilder';
import {ComptrollerErrorReporter} from '../ErrorReporter';
import {getComptroller, getComptrollerImpl} from '../ContractLookup';
import {getLiquidity} from '../Value/ComptrollerValue';
import {getCTokenV} from '../Value/CTokenValue';
import {encodedNumber} from '../Encoding';
import {encodeABI, rawValues} from "../Utils";

async function genComptroller(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, comptrollerImpl: comptroller, comptrollerImplData: comptrollerData} = await buildComptrollerImpl(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added Comptroller (${comptrollerData.description}) at address ${comptroller._address}`,
    comptrollerData.invokation
  );

  return world;
};

async function setProtocolPaused(world: World, from: string, comptroller: Comptroller, isPaused: boolean): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setProtocolPaused(isPaused), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: set protocol paused to ${isPaused}`,
    invokation
  );

  return world;
}

async function setMaxAssets(world: World, from: string, comptroller: Comptroller, numberOfAssets: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setMaxAssets(numberOfAssets.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set max assets to ${numberOfAssets.show()}`,
    invokation
  );

  return world;
}

async function setLiquidationIncentive(world: World, from: string, comptroller: Comptroller, liquidationIncentive: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setLiquidationIncentive(liquidationIncentive.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set liquidation incentive to ${liquidationIncentive.show()}`,
    invokation
  );

  return world;
}

async function supportMarket(world: World, from: string, comptroller: Comptroller, cToken: CToken): Promise<World> {
  if (world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world.printer.printLine(`Dry run: Supporting market  \`${cToken._address}\``);
    return world;
  }

  let invokation = await invoke(world, comptroller.methods._supportMarket(cToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Supported market ${cToken.name}`,
    invokation
  );

  return world;
}

async function unlistMarket(world: World, from: string, comptroller: Comptroller, cToken: CToken): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.unlist(cToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Unlisted market ${cToken.name}`,
    invokation
  );

  return world;
}

async function enterMarkets(world: World, from: string, comptroller: Comptroller, assets: string[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.enterMarkets(assets), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Called enter assets ${assets} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function exitMarket(world: World, from: string, comptroller: Comptroller, asset: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.exitMarket(asset), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Called exit market ${asset} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setPriceOracle(world: World, from: string, comptroller: Comptroller, priceOracleAddr: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPriceOracle(priceOracleAddr), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set price oracle for to ${priceOracleAddr} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setCollateralFactor(world: World, from: string, comptroller: Comptroller, cToken: CToken, collateralFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCollateralFactor(cToken._address, collateralFactor.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set collateral factor for ${cToken.name} to ${collateralFactor.show()}`,
    invokation
  );

  return world;
}

async function setCloseFactor(world: World, from: string, comptroller: Comptroller, closeFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setCloseFactor(closeFactor.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set close factor to ${closeFactor.show()}`,
    invokation
  );

  return world;
}

async function setBUMMintRate(world: World, from: string, comptroller: Comptroller, bumMintRate: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setBUMMintRate(bumMintRate.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set bum mint rate to ${bumMintRate.show()}`,
    invokation
  );

  return world;
}

async function setBUMController(world: World, from: string, comptroller: Comptroller, bumcontroller: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setBUMController(bumcontroller), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set BUMController to ${bumcontroller} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}
async function setChumHumBUMVaultRate(world: World, from: string, comptroller: Comptroller, chumhumBUMVaultRate: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setChumHumBUMVaultRate(chumhumBUMVaultRate.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set bum mint rate to ${chumhumBUMVaultRate.show()}`,
    invokation
  );

  return world;
}
async function fastForward(world: World, from: string, comptroller: Comptroller, blocks: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.fastForward(blocks.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Fast forward ${blocks.show()} blocks to #${invokation.value}`,
    invokation
  );

  return world;
}

async function sendAny(world: World, from:string, comptroller: Comptroller, signature: string, callArgs: string[]): Promise<World> {
  const fnData = encodeABI(world, signature, callArgs);
  await world.web3.eth.sendTransaction({
      to: comptroller._address,
      data: fnData,
      from: from
    })
  return world;
}

async function addChumHumMarkets(world: World, from: string, comptroller: Comptroller, cTokens: CToken[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._addChumHumMarkets(cTokens.map(c => c._address)), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Added ChumHum markets ${cTokens.map(c => c.name)}`,
    invokation
  );

  return world;
}

async function dropChumHumMarket(world: World, from: string, comptroller: Comptroller, cToken: CToken): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._dropChumHumMarket(cToken._address), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Drop ChumHum market ${cToken.name}`,
    invokation
  );

  return world;
}

async function refreshChumHumSpeeds(world: World, from: string, comptroller: Comptroller): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.refreshChumHumSpeeds(), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Refreshed ChumHum speeds`,
    invokation
  );

  return world;
}

async function claimChumHum(world: World, from: string, comptroller: Comptroller, holder: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods.claimChumHum(holder), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `CHUM claimed by ${holder}`,
    invokation
  );

  return world;
}

async function setChumHumRate(world: World, from: string, comptroller: Comptroller, rate: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setChumHumRate(rate.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `CHUM rate set to ${rate.show()}`,
    invokation
  );

  return world;
}

async function setChumHumSpeed(world: World, from: string, comptroller: Comptroller, cToken: CToken, speed: NumberV): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setChumHumSpeed(cToken._address, speed.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `ChumHum speed for market ${cToken._address} set to ${speed.show()}`,
    invokation
  );

  return world;
}

async function printLiquidity(world: World, comptroller: Comptroller): Promise<World> {
  let enterEvents = await getPastEvents(world, comptroller, 'StdComptroller', 'MarketEntered');
  let addresses = enterEvents.map((event) => event.returnValues['account']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Liquidity:")

  const liquidityMap = await Promise.all(uniq.map(async (address) => {
    let userLiquidity = await getLiquidity(world, comptroller, address);

    return [address, userLiquidity.val];
  }));

  liquidityMap.forEach(([address, liquidity]) => {
    world.printer.printLine(`\t${world.settings.lookupAlias(address)}: ${liquidity / 1e18}e18`)
  });

  return world;
}

async function setPendingAdmin(world: World, from: string, comptroller: Comptroller, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setPendingAdmin(newPendingAdmin), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, comptroller: Comptroller): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._acceptAdmin(), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function setMarketBorrowCaps(world: World, from: string, comptroller: Comptroller, cTokens: CToken[], borrowCaps: NumberV[]): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setMarketBorrowCaps(cTokens.map(c => c._address), borrowCaps.map(c => c.encode())), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Borrow caps on ${cTokens} set to ${borrowCaps}`,
    invokation
  );

  return world;
}

async function setBorrowCapGuardian(world: World, from: string, comptroller: Comptroller, newBorrowCapGuardian: string): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setBorrowCapGuardian(newBorrowCapGuardian), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Comptroller: ${describeUser(world, from)} sets borrow cap guardian to ${newBorrowCapGuardian}`,
    invokation
  );

  return world;
}

async function setTreasuryData(
  world: World,
  from: string,
  comptroller: Comptroller,
  guardian: string,
  address: string,
  percent: NumberV,
): Promise<World> {
  let invokation = await invoke(world, comptroller.methods._setTreasuryData(guardian, address, percent.encode()), from, ComptrollerErrorReporter);

  world = addAction(
    world,
    `Set treasury data to guardian: ${guardian}, address: ${address}, percent: ${percent.show()}`,
    invokation
  );

  return world;
}

export function comptrollerCommands() {
  return [
    new Command<{comptrollerParams: EventV}>(`
        #### Deploy

        * "Comptroller Deploy ...comptrollerParams" - Generates a new Comptroller (not as Impl)
          * E.g. "Comptroller Deploy YesNo"
      `,
      "Deploy",
      [new Arg("comptrollerParams", getEventV, {variadic: true})],
      (world, from, {comptrollerParams}) => genComptroller(world, from, comptrollerParams.val)
    ),
    new Command<{comptroller: Comptroller, isPaused: BoolV}>(`
        #### SetProtocolPaused

        * "Comptroller SetProtocolPaused <Bool>" - Pauses or unpaused protocol
          * E.g. "Comptroller SetProtocolPaused True"
      `,
      "SetProtocolPaused",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("isPaused", getBoolV)
      ],
      (world, from, {comptroller, isPaused}) => setProtocolPaused(world, from, comptroller, isPaused.val)
    ),
    new Command<{comptroller: Comptroller, cToken: CToken}>(`
        #### SupportMarket

        * "Comptroller SupportMarket <CToken>" - Adds support in the Comptroller for the given cToken
          * E.g. "Comptroller SupportMarket cZRX"
      `,
      "SupportMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV)
      ],
      (world, from, {comptroller, cToken}) => supportMarket(world, from, comptroller, cToken)
    ),
    new Command<{comptroller: Comptroller, cToken: CToken}>(`
        #### UnList

        * "Comptroller UnList <CToken>" - Mock unlists a given market in tests
          * E.g. "Comptroller UnList cZRX"
      `,
      "UnList",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV)
      ],
      (world, from, {comptroller, cToken}) => unlistMarket(world, from, comptroller, cToken)
    ),
    new Command<{comptroller: Comptroller, cTokens: CToken[]}>(`
        #### EnterMarkets

        * "Comptroller EnterMarkets (<CToken> ...)" - User enters the given markets
          * E.g. "Comptroller EnterMarkets (cZRX cMATIC)"
      `,
      "EnterMarkets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cTokens", getCTokenV, {mapped: true})
      ],
      (world, from, {comptroller, cTokens}) => enterMarkets(world, from, comptroller, cTokens.map((c) => c._address))
    ),
    new Command<{comptroller: Comptroller, cToken: CToken}>(`
        #### ExitMarket

        * "Comptroller ExitMarket <CToken>" - User exits the given markets
          * E.g. "Comptroller ExitMarket cZRX"
      `,
      "ExitMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV)
      ],
      (world, from, {comptroller, cToken}) => exitMarket(world, from, comptroller, cToken._address)
    ),
    new Command<{comptroller: Comptroller, maxAssets: NumberV}>(`
        #### SetMaxAssets

        * "Comptroller SetMaxAssets <Number>" - Sets (or resets) the max allowed asset count
          * E.g. "Comptroller SetMaxAssets 4"
      `,
      "SetMaxAssets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("maxAssets", getNumberV)
      ],
      (world, from, {comptroller, maxAssets}) => setMaxAssets(world, from, comptroller, maxAssets)
    ),
    new Command<{comptroller: Comptroller, liquidationIncentive: NumberV}>(`
        #### LiquidationIncentive

        * "Comptroller LiquidationIncentive <Number>" - Sets the liquidation incentive
          * E.g. "Comptroller LiquidationIncentive 1.1"
      `,
      "LiquidationIncentive",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("liquidationIncentive", getExpNumberV)
      ],
      (world, from, {comptroller, liquidationIncentive}) => setLiquidationIncentive(world, from, comptroller, liquidationIncentive)
    ),
    new Command<{comptroller: Comptroller, priceOracle: AddressV}>(`
        #### SetPriceOracle

        * "Comptroller SetPriceOracle oracle:<Address>" - Sets the price oracle address
          * E.g. "Comptroller SetPriceOracle 0x..."
      `,
      "SetPriceOracle",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("priceOracle", getAddressV)
      ],
      (world, from, {comptroller, priceOracle}) => setPriceOracle(world, from, comptroller, priceOracle.val)
    ),
    new Command<{comptroller: Comptroller, cToken: CToken, collateralFactor: NumberV}>(`
        #### SetCollateralFactor

        * "Comptroller SetCollateralFactor <CToken> <Number>" - Sets the collateral factor for given cToken to number
          * E.g. "Comptroller SetCollateralFactor cZRX 0.1"
      `,
      "SetCollateralFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV),
        new Arg("collateralFactor", getExpNumberV)
      ],
      (world, from, {comptroller, cToken, collateralFactor}) => setCollateralFactor(world, from, comptroller, cToken, collateralFactor)
    ),
    new Command<{comptroller: Comptroller, closeFactor: NumberV}>(`
        #### SetCloseFactor

        * "Comptroller SetCloseFactor <Number>" - Sets the close factor to given percentage
          * E.g. "Comptroller SetCloseFactor 0.2"
      `,
      "SetCloseFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("closeFactor", getPercentV)
      ],
      (world, from, {comptroller, closeFactor}) => setCloseFactor(world, from, comptroller, closeFactor)
    ),
    new Command<{comptroller: Comptroller, bumMintRate: NumberV}>(`
        #### SetBUMMintRate

        * "Comptroller SetBUMMintRate <Number>" - Sets the bum mint rate to given value
          * E.g. "Comptroller SetBUMMintRate 5e4"
      `,
      "SetBUMMintRate",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("bumMintRate", getNumberV)
      ],
      (world, from, {comptroller, bumMintRate}) => setBUMMintRate(world, from, comptroller, bumMintRate)
    ),
    new Command<{comptroller: Comptroller, bumcontroller: AddressV}>(`
        #### SetBUMController

        * "Comptroller SetBUMController bumcontroller:<Address>" - Sets the bum controller address
          * E.g. "Comptroller SetBUMController 0x..."
      `,
      "SetBUMController",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("bumcontroller", getAddressV)
      ],
      (world, from, {comptroller, bumcontroller}) => setBUMController(world, from, comptroller, bumcontroller.val)
    ),
    new Command<{comptroller: Comptroller, chumhumBUMVaultRate: NumberV}>(`
        #### SetChumHumBUMVaultRate

        * "Comptroller SetChumHumBUMVaultRate chumhumBUMVaultRate:<Number>" - Sets the chumhum bum vault rate for the Comptroller
          * E.g. "Comptroller SetChumHumBUMVaultRate 234"
      `,
      "SetChumHumBUMVaultRate",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("chumhumBUMVaultRate", getNumberV)
      ],
      (world, from, {comptroller, chumhumBUMVaultRate}) => setChumHumBUMVaultRate(world, from, comptroller, chumhumBUMVaultRate)
    ),
    new Command<{comptroller: Comptroller, newPendingAdmin: AddressV}>(`
        #### SetPendingAdmin

        * "Comptroller SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the Comptroller
          * E.g. "Comptroller SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("newPendingAdmin", getAddressV)
      ],
      (world, from, {comptroller, newPendingAdmin}) => setPendingAdmin(world, from, comptroller, newPendingAdmin.val)
    ),
    new Command<{comptroller: Comptroller}>(`
        #### AcceptAdmin

        * "Comptroller AcceptAdmin" - Accepts admin for the Comptroller
          * E.g. "From Geoff (Comptroller AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, from, {comptroller}) => acceptAdmin(world, from, comptroller)
    ),
    new Command<{comptroller: Comptroller, blocks: NumberV, _keyword: StringV}>(`
        #### FastForward

        * "FastForward n:<Number> Blocks" - Moves the block number forward "n" blocks. Note: in "CTokenScenario" and "ComptrollerScenario" the current block number is mocked (starting at 100000). This is the only way for the protocol to see a higher block number (for accruing interest).
          * E.g. "Comptroller FastForward 5 Blocks" - Move block number forward 5 blocks.
      `,
      "FastForward",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("blocks", getNumberV),
        new Arg("_keyword", getStringV)
      ],
      (world, from, {comptroller, blocks}) => fastForward(world, from, comptroller, blocks)
    ),
    new View<{comptroller: Comptroller}>(`
        #### Liquidity

        * "Comptroller Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, {comptroller}) => printLiquidity(world, comptroller)
    ),
    new View<{comptroller: Comptroller, input: StringV}>(`
        #### Decode

        * "Decode input:<String>" - Prints information about a call to a Comptroller contract
      `,
      "Decode",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("input", getStringV)

      ],
      (world, {comptroller, input}) => decodeCall(world, comptroller, input.val)
    ),

    new Command<{comptroller: Comptroller, signature: StringV, callArgs: StringV[]}>(`
      #### Send
      * Comptroller Send functionSignature:<String> callArgs[] - Sends any transaction to comptroller
      * E.g: Comptroller Send "setCHUMAddress(address)" (Address CHUM)
      `,
      "Send",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      (world, from, {comptroller, signature, callArgs}) => sendAny(world, from, comptroller, signature.val, rawValues(callArgs))
    ),
    new Command<{comptroller: Comptroller, cTokens: CToken[]}>(`
      #### AddChumHumMarkets

      * "Comptroller AddChumHumMarkets (<Address> ...)" - Makes a market CHUM-enabled
      * E.g. "Comptroller AddChumHumMarkets (cZRX cBAT)
      `,
      "AddChumHumMarkets",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cTokens", getCTokenV, {mapped: true})
      ],
      (world, from, {comptroller, cTokens}) => addChumHumMarkets(world, from, comptroller, cTokens)
     ),
    new Command<{comptroller: Comptroller, cToken: CToken}>(`
      #### DropChumHumMarket

      * "Comptroller DropChumHumMarket <Address>" - Makes a market CHUM
      * E.g. "Comptroller DropChumHumMarket cZRX
      `,
      "DropChumHumMarket",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV)
      ],
      (world, from, {comptroller, cToken}) => dropChumHumMarket(world, from, comptroller, cToken)
     ),

    new Command<{comptroller: Comptroller}>(`
      #### RefreshChumHumSpeeds

      * "Comptroller RefreshChumHumSpeeds" - Recalculates all the ChumHum market speeds
      * E.g. "Comptroller RefreshChumHumSpeeds
      `,
      "RefreshChumHumSpeeds",
      [
        new Arg("comptroller", getComptroller, {implicit: true})
      ],
      (world, from, {comptroller}) => refreshChumHumSpeeds(world, from, comptroller)
    ),
    new Command<{comptroller: Comptroller, holder: AddressV}>(`
      #### ClaimChumHum

      * "Comptroller ClaimChumHum <holder>" - Claims chum
      * E.g. "Comptroller ClaimChumHum Geoff
      `,
      "ClaimChumHum",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("holder", getAddressV)
      ],
      (world, from, {comptroller, holder}) => claimChumHum(world, from, comptroller, holder.val)
    ),
    new Command<{comptroller: Comptroller, rate: NumberV}>(`
      #### SetChumHumRate

      * "Comptroller SetChumHumRate <rate>" - Sets ChumHum rate
      * E.g. "Comptroller SetChumHumRate 1e18
      `,
      "SetChumHumRate",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("rate", getNumberV)
      ],
      (world, from, {comptroller, rate}) => setChumHumRate(world, from, comptroller, rate)
    ),
    new Command<{comptroller: Comptroller, cToken: CToken, speed: NumberV}>(`
      #### SetChumHumSpeed
      * "Comptroller SetChumHumSpeed <cToken> <rate>" - Sets CHUM speed for market
      * E.g. "Comptroller SetChumHumSpeed cToken 1000
      `,
      "SetChumHumSpeed",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cToken", getCTokenV),
        new Arg("speed", getNumberV)
      ],
      (world, from, {comptroller, cToken, speed}) => setChumHumSpeed(world, from, comptroller, cToken, speed)
    ),
    new Command<{comptroller: Comptroller, cTokens: CToken[], borrowCaps: NumberV[]}>(`
      #### SetMarketBorrowCaps
      * "Comptroller SetMarketBorrowCaps (<CToken> ...) (<borrowCap> ...)" - Sets Market Borrow Caps
      * E.g "Comptroller SetMarketBorrowCaps (cZRX cUSDC) (10000.0e18, 1000.0e6)
      `,
      "SetMarketBorrowCaps",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("cTokens", getCTokenV, {mapped: true}),
        new Arg("borrowCaps", getNumberV, {mapped: true})
      ],
      (world, from, {comptroller,cTokens,borrowCaps}) => setMarketBorrowCaps(world, from, comptroller, cTokens, borrowCaps)
    ),
    new Command<{comptroller: Comptroller, newBorrowCapGuardian: AddressV}>(`
        #### SetBorrowCapGuardian
        * "Comptroller SetBorrowCapGuardian newBorrowCapGuardian:<Address>" - Sets the Borrow Cap Guardian for the Comptroller
          * E.g. "Comptroller SetBorrowCapGuardian Geoff"
      `,
      "SetBorrowCapGuardian",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("newBorrowCapGuardian", getAddressV)
      ],
      (world, from, {comptroller, newBorrowCapGuardian}) => setBorrowCapGuardian(world, from, comptroller, newBorrowCapGuardian.val)
    ),
    new Command<{comptroller: Comptroller, guardian: AddressV, address: AddressV, percent: NumberV}>(`
      #### SetTreasuryData
      * "Comptroller SetTreasuryData <guardian> <address> <rate>" - Sets Treasury Data
      * E.g. "Comptroller SetTreasuryData 0x.. 0x.. 1e18
      `,
      "SetTreasuryData",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("guardian", getAddressV),
        new Arg("address", getAddressV),
        new Arg("percent", getNumberV)
      ],
      (world, from, {comptroller, guardian, address, percent}) => setTreasuryData(world, from, comptroller, guardian.val, address.val, percent)
    )
  ];
}

export async function processComptrollerEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Comptroller", comptrollerCommands(), world, event, from);
}
