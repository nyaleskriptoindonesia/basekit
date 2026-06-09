// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "solmate/tokens/ERC20.sol";

contract BaseKitToken is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) ERC20(_name, _symbol, 18) {
        _mint(msg.sender, _initialSupply * 1e18);
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
        BaseKitToken newToken = new BaseKitToken(name, symbol, initialSupply);
        token = address(newToken);
        emit TokenCreated(token, msg.sender, name, symbol, initialSupply);
    }
}
