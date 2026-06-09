// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BaseKitRegistry } from "./src/BaseKitRegistry.sol";
import { BaseKitToken } from "./src/BaseKitToken.sol";

contract DeployScript {
    function run() external {
        address owner = msg.sender;
        console.log("Deploying from:", owner);

        // Deploy Registry
        BaseKitRegistry registry = new BaseKitRegistry(owner);
        console.log("Registry deployed:", address(registry));

        // Deploy Token Master
        BaseKitToken token = new BaseKitToken();
        console.log("Token master deployed:", address(token));

        // Set token master
        registry.setTokenMaster(address(token));
        console.log("Token master set on registry");
    }
}
