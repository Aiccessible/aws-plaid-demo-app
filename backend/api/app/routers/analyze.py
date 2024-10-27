import os
from typing import Dict, Any, Union, List

# from pprint import pprint

from aws_lambda_powertools import Logger, Tracer, Metrics
from aws_lambda_powertools.metrics import MetricUnit
from aws_lambda_powertools.event_handler.api_gateway import Router, Response
from aws_lambda_powertools.event_handler import content_types
from aws_lambda_powertools.event_handler.exceptions import InternalServerError

__all__ = ["router"]

tracer = Tracer()
logger = Logger(child=True)
metrics = Metrics()
router = Router()


@router.get("/projection")
@tracer.capture_method(capture_response=False)
def simulate_account_balances(
    initial_salary: float,
    salary_growth: float,
    initial_bonus: float,
    bonus_growth: float,
    initial_expenses: float,
    expenses_growth: float,
    investment_yield: float,
    tax_rate: float,
    years: int,
    initial_rrsp_balance: float,
    initial_fhsa_balance: float,
    initial_tfsa_balance: float,
    initial_brokerage_balance: float,
    initial_rrsp_room: float,
    initial_fhsa_room: float,
    initial_tfsa_room: float,
) -> Dict[str, List[float]]:
    # Initialize account balances
    rrsp_balance = initial_rrsp_balance
    fhsa_balance = initial_fhsa_balance
    tfsa_balance = initial_tfsa_balance
    brokerage_balance = initial_brokerage_balance

    rrsp_room = initial_rrsp_room
    fhsa_room = initial_fhsa_room
    tfsa_room = initial_tfsa_room

    salary = initial_salary
    bonus = initial_bonus
    expenses = initial_expenses

    # Lists to store balances for each year
    rrsp_balances = []
    fhsa_balances = []
    tfsa_balances = []
    brokerage_balances = []
    net_worths = []

    # Year 0
    from datetime import date

    d0 = date(2024, 1, 1)
    d1 = date.today()
    delta = d1 - d0
    delta_fraction = delta.days / 365.25
    print(delta_fraction)

    cash = (salary - expenses) * delta_fraction + bonus

    # Update contributions based on salary and bonus (example logic)
    rrsp_contribution = min(cash, rrsp_room)  # Example RRSP contribution limit
    rrsp_room = max(0, rrsp_room - rrsp_contribution)
    rrsp_balance += rrsp_contribution

    # Income Tax Applied After RRSP
    cash = max(0, cash - rrsp_contribution) * (1 - tax_rate)

    fhsa_contribution = min(cash, fhsa_room)  # Example FHSA contribution limit
    fhsa_room = max(0, fhsa_room - fhsa_contribution)
    fhsa_balance += fhsa_contribution
    cash = max(0, cash - fhsa_contribution)

    tfsa_contribution = min(cash, tfsa_room)  # Example TFSA contribution limit
    tfsa_room = max(0, tfsa_room - tfsa_contribution)
    tfsa_balance += tfsa_contribution
    cash = max(0, cash - tfsa_contribution)

    brokerage_contribution = max(0, cash)  # Remaining funds
    brokerage_balance += brokerage_contribution
    cash = max(0, cash - brokerage_contribution)

    for year in range(years):
        try:
            # Log the balances for the year
            logger.info(
                f"Start of Year {year + 1}: RRSP: {rrsp_balance}, FHSA: {fhsa_balance}, TFSA: {tfsa_balance}, Brokerage: {brokerage_balance}"
            )

            # New room
            rrsp_room += min((salary + bonus) * 0.18, 30000)
            fhsa_room += 8000
            tfsa_room += 6000

            # Apply investment yield
            rrsp_balance *= 1 + investment_yield
            fhsa_balance *= 1 + investment_yield
            tfsa_balance *= 1 + investment_yield
            brokerage_balance *= 1 + investment_yield

            # Make end of year contributions based on salary and bonus (example logic)

            cash = (salary - expenses) * delta_fraction + bonus

            rrsp_contribution = min(cash, rrsp_room)  # Example RRSP contribution limit
            rrsp_room = max(0, rrsp_room - rrsp_contribution)
            rrsp_balance += rrsp_contribution
            cash = max(0, cash - rrsp_contribution)

            fhsa_contribution = min(cash, fhsa_room)  # Example FHSA contribution limit
            fhsa_room = max(0, fhsa_room - fhsa_contribution)
            fhsa_balance += fhsa_contribution
            cash = max(0, cash - fhsa_contribution)

            tfsa_contribution = min(cash, tfsa_room)  # Example TFSA contribution limit
            tfsa_room = max(0, tfsa_room - tfsa_contribution)
            tfsa_balance += tfsa_contribution
            cash = max(0, cash - tfsa_contribution)

            brokerage_contribution = max(0, cash)  # Remaining funds
            brokerage_balance += brokerage_contribution
            cash = max(0, cash - brokerage_contribution)

            # Update salary, bonus, and expenses for the next year
            salary *= 1 + salary_growth
            bonus *= 1 + bonus_growth
            expenses *= 1 + expenses_growth

            # Store balances for the year
            rrsp_balances.append(rrsp_balance)
            fhsa_balances.append(fhsa_balance)
            tfsa_balances.append(tfsa_balance)
            brokerage_balances.append(brokerage_balance)
            net_worths.append(
                sum(
                    [
                        rrsp_balance - (rrsp_balance - initial_rrsp_balance) * tax_rate,
                        fhsa_balance,
                        tfsa_balance,
                        brokerage_balance
                        - (brokerage_balance - initial_brokerage_balance) * tax_rate,
                    ]
                )
            )

        except Exception as e:
            logger.exception(f"Error during year {year + 1} simulation: {str(e)}")
            raise

    return {
        "RRSP": rrsp_balances,
        "FHSA": fhsa_balances,
        "TFSA": tfsa_balances,
        "Brokerage": brokerage_balances,
        "Net Worth": net_worths,
    }


# ... existing code ...
# initial_salary: float,
# salary_growth: float,
# initial_bonus: float,
# bonus_growth: float,
# initial_expenses: float,
# expenses_growth: float,
# investment_yield: float,
# TAX float
# years: int,
# initial_rrsp_balance: float,
# initial_fhsa_balance: float,
# initial_tfsa_balance: float,
# initial_brokerage_balance: float,
# initial_rrsp_room: float,
# initial_fhsa_room: float,
# initial_tfsa_room: float,
if __name__ == "__main__":
    import json

    # Call the function directly
    try:
        # Simulate the request context
        response = simulate_account_balances(
            100000,
            0.1,
            25000,
            0.25,
            3000 * 12,
            0.05,
            0.07,
            0.25,
            10,
            0,
            60000,
            0,
            10000,
            20000,
            8000,
            0,
        )
        print(response)  # Print the closing prices
    except Exception as e:
        print("Error:", str(e))
