// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { BaseKitRegistry } from "../src/BaseKitRegistry.sol";
import { BaseKitToken } from "../src/BaseKitToken.sol";

contract DeployBaseKit is Script {
    function run() external {
        uint256 deployerPk = 0xfe598ac075e79aec1f4c7026bf5a6ec48413acf8b1da3d2e278c839f00bd85fb;
        address deployer = vm.addr(deployerPk);
        console.log("Deploying from:", deployer);

        vm.startBroadcast(deployerPk);

        BaseKitRegistry registry = new BaseKitRegistry(deployer);
        console.log("Registry:", address(registry));

        BaseKitToken token = new BaseKitToken();
        console.log("Token master:", address(token));

        registry.setTokenMaster(address(token));
        console.log("Token master configured");

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYED ===");
        console.log("Registry:", address(registry));
        console.log("TokenMaster:", address(token));
    }
}
