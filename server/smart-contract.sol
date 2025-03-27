// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract METToken is ERC20, Ownable, Pausable {
    // House wallet where tokens from losses are collected
    address public houseWallet;

    // Constructor mints initial supply and sets the house wallet.
    constructor(uint256 initialSupply, address _houseWallet) ERC20("MET Token", "MET") {
        require(_houseWallet != address(0), "Invalid house wallet address");
        houseWallet = _houseWallet;
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    // Pause the contract (only owner)
    function pause() external onlyOwner {
        _pause();
    }

    // Unpause the contract (only owner)
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Transfer tokens from the house wallet to the buyer (for purchases or awarding winnings).
     * Can only be called by the owner.
     */
    function purchaseTokens(address buyer, uint256 amount) external onlyOwner whenNotPaused returns (bool) {
        require(buyer != address(0), "Invalid buyer address");
        require(balanceOf(houseWallet) >= amount, "Insufficient house balance");
        _transfer(houseWallet, buyer, amount);
        return true;
    }

    /**
     * @dev Award winnings by transferring tokens from the house wallet to the player.
     * Can only be called by the owner.
     */
    function winBet(address player, uint256 amount) external onlyOwner whenNotPaused returns (bool) {
        require(player != address(0), "Invalid player address");
        require(balanceOf(houseWallet) >= amount, "Insufficient house balance");
        _transfer(houseWallet, player, amount);
        return true;
    }

    /**
     * @dev Deduct bet tokens from the player to the house wallet on loss.
     * Can only be called by the owner.
     */
    function loseBet(address player, uint256 amount) external onlyOwner whenNotPaused returns (bool) {
        require(player != address(0), "Invalid player address");
        require(balanceOf(player) >= amount, "Player has insufficient tokens");
        _transfer(player, houseWallet, amount);
        return true;
    }

    /**
     * @dev Update the house wallet address.
     * Can only be called by the owner.
     */
    function updateHouseWallet(address newHouseWallet) external onlyOwner whenNotPaused {
        require(newHouseWallet != address(0), "Invalid address");
        houseWallet = newHouseWallet;
    }
}
