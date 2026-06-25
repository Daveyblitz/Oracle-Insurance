// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract OracleInsurance {

    address public owner;

    struct Policy {
        uint256 triggerPrice;
        uint256 payoutAmount;
        bool active;
        bool paid;
    }

    mapping(address => Policy) public policies;

    uint256 public currentPrice;

    event PolicyPurchased(
        address indexed holder,
        uint256 triggerPrice,
        uint256 payoutAmount
    );

    event PriceUpdated(uint256 newPrice);

    event PayoutTriggered(
        address indexed holder,
        uint256 payoutAmount
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not oracle");
        _;
    }

    receive() external payable {}

    function buyPolicy(
        uint256 _triggerPrice,
        uint256 _payoutAmount
    ) public {

        policies[msg.sender] = Policy({
            triggerPrice: _triggerPrice,
            payoutAmount: _payoutAmount,
            active: true,
            paid: false
        });

        emit PolicyPurchased(
            msg.sender,
            _triggerPrice,
            _payoutAmount
        );
    }

    function updatePrice(uint256 _price)
        public
        onlyOwner
    {
        currentPrice = _price;

        emit PriceUpdated(_price);
    }

    function checkAndPayout() public {

        Policy storage policy = policies[msg.sender];

        require(policy.active, "No active policy");
        require(!policy.paid, "Already paid");

        if (currentPrice < policy.triggerPrice) {

            require(
                address(this).balance >= policy.payoutAmount,
                "Insufficient contract funds"
            );

            policy.paid = true;
            policy.active = false;

            payable(msg.sender).transfer(
                policy.payoutAmount
            );

            emit PayoutTriggered(
                msg.sender,
                policy.payoutAmount
            );
        }
    }

    function contractBalance()
        public
        view
        returns (uint256)
    {
        return address(this).balance;
    }
}