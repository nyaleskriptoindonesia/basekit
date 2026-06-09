// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { BaseKitRegistry } from "../src/BaseKitRegistry.sol";
import { BaseKitToken } from "../src/BaseKitToken.sol";

contract DeployBaseKit is Script {
    function run() external {
        address owner = msg.sender;
        console.log("Deploying from:", owner);

        vm.startBroadcast(owner);

        BaseKitRegistry registry = new BaseKitRegistry(owner);
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
