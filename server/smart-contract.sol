// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract METToken {
    string public name = "MET Token";
    string public symbol = "MET";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    address public owner;
    address public houseWallet;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(uint256 _initialSupply, address _houseWallet) {
        owner = msg.sender;
        houseWallet = _houseWallet;
        totalSupply = _initialSupply * 10 ** uint256(decimals);
        balanceOf[owner] = totalSupply;
    }

    // Standard transfer function
    function transfer(address _to, uint256 _value) public returns (bool success) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    // Purchase tokens: players send BNB and MET tokens are transferred from house wallet to player
    // Note: In practice, you'll need to handle payable and conversion; this is simplified.
    function purchaseTokens(address buyer, uint256 metAmount) public returns (bool success) {
        require(balanceOf[houseWallet] >= metAmount, "House wallet has insufficient tokens");
        balanceOf[houseWallet] -= metAmount;
        balanceOf[buyer] += metAmount;
        emit Transfer(houseWallet, buyer, metAmount);
        return true;
    }

    // Lose bet: transfer tokens from player to house wallet
    function loseBet(address player, uint256 betAmount) public returns (bool success) {
        require(balanceOf[player] >= betAmount, "Insufficient balance");
        balanceOf[player] -= betAmount;
        balanceOf[houseWallet] += betAmount;
        emit Transfer(player, houseWallet, betAmount);
        return true;
    }
}
