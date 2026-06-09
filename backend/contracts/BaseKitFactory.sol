// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "solmate/tokens/ERC20.sol";

contract BaseKitToken is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) ERC20(_name, _symbol, 18) {
        _mint(msg.sender, _initialSupply * 10 ** decimals());
    }
}

contract BaseKitFactory {
    event TokenCreated(
        address indexed token,
        address indexed deployer,
        string name,
        string symbol,
        uint256 supply
    );

    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external returns (address token) {
        bytes memory bytecode = abi.encodePacked(
            type(BaseKitToken).creationCode,
            abi.encode(name, symbol, initialSupply)
        );

        bytes32 salt = keccak256(abi.encodePacked(name, symbol, msg.sender, block.timestamp));
        assembly {
            token := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        emit TokenCreated(token, msg.sender, name, symbol, initialSupply);
    }
}
