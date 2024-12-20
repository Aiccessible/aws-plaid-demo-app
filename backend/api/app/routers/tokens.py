#!/usr/bin/env python
# -*- coding: utf-8 -*-

from functools import partial
import os
from typing import Dict, Union

from aws_lambda_powertools import Logger, Tracer, Metrics
from aws_lambda_powertools.metrics import MetricUnit
from aws_lambda_powertools.event_handler.api_gateway import Router, Response
from aws_lambda_powertools.event_handler import content_types
from aws_lambda_powertools.event_handler.exceptions import (
    InternalServerError,
    BadRequestError,
)
import boto3
import botocore
from dynamodb_encryption_sdk.encrypted.client import EncryptedClient
from dynamodb_encryption_sdk.identifiers import CryptoAction
from dynamodb_encryption_sdk.material_providers.aws_kms import AwsKmsCryptographicMaterialsProvider
from dynamodb_encryption_sdk.structures import AttributeActions
from dynamodb_encryption_sdk.internal.utils import encrypt_put_item
from mypy_boto3_dynamodb import DynamoDBServiceResource, DynamoDBClient
from mypy_boto3_dynamodb.service_resource import Table
import plaid
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.link_token_create_response import LinkTokenCreateResponse
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.item_public_token_exchange_response import ItemPublicTokenExchangeResponse
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.transfer_user_in_request import TransferUserInRequest
from plaid.model.transfer_intent_create_request import TransferIntentCreateRequest
from plaid.model.transfer_capabilities_get_request import TransferCapabilitiesGetRequest
from plaid.model.transfer_intent_create_mode import TransferIntentCreateMode
from plaid.model.transfer_intent_create_network import TransferIntentCreateNetwork
from plaid.model.ach_class import ACHClass
import json
from app import utils, constants, datastore, exceptions
import uuid
from plaid.model.transfer_metadata import TransferMetadata
__all__ = ["router"]

TABLE_NAME = os.getenv("TABLE_NAME")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")
KEY_ARN = os.getenv("KEY_ARN")

tracer = Tracer()
logger = Logger(child=True)
metrics = Metrics()
router = Router()

dynamodb: DynamoDBServiceResource = boto3.resource("dynamodb", config=constants.BOTO3_CONFIG)


@router.get("/")
@tracer.capture_method(capture_response=False)
def create_link_token() -> Dict[str, str]:
    user_id: str = utils.authorize_request(router)

    logger.append_keys(user_id=user_id)
    tracer.put_annotation(key="UserId", value=user_id)

    request = LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="Wieser",
        country_codes=[CountryCode("CA")],
        language="en",
        webhook=WEBHOOK_URL,
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
        required_if_supported_products=[Products("investments")],
        investments_auth={
            "masked_number_match_enabled": True,
            "stated_account_number_enabled": True,
            "manual_entry_enabled": True
        }
    )

    client = utils.get_plaid_client()

    try:
        response: LinkTokenCreateResponse = client.link_token_create(request)
    except plaid.ApiException:
        logger.exception("Unable to create link token")
        raise InternalServerError("Failed to create link token")

    return {"link_token": response.link_token}

@router.get("/get_investment_token")
@tracer.capture_method(capture_response=False)
def create_link_token() -> Dict[str, str]:
    user_id: str = utils.authorize_request(router)

    logger.append_keys(user_id=user_id)
    tracer.put_annotation(key="UserId", value=user_id)

    request = LinkTokenCreateRequest(
        products=[Products("investments")],
        client_name="Wieser",
        country_codes=[CountryCode("CA")],
        language="en",
        webhook=WEBHOOK_URL,
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
        investments_auth={
            "masked_number_match_enabled": True,
            "stated_account_number_enabled": True,
            "manual_entry_enabled": True
        }
    )

    client = utils.get_plaid_client()

    try:
        response: LinkTokenCreateResponse = client.link_token_create(request)
    except plaid.ApiException:
        logger.exception("Unable to create link token")
        raise InternalServerError("Failed to create link token")

    return {"link_token": response.link_token}

@router.post("/")
@tracer.capture_method(capture_response=False)
def exchange_token() -> Response:
    user_id: str = utils.authorize_request(router)

    logger.append_keys(user_id=user_id)
    tracer.put_annotation(key="UserId", value=user_id)

    # TODO: validate against METADATA_SCHEMA

    public_token: Union[None, str] = router.current_event.json_body.get("public_token")
    if not public_token:
        raise BadRequestError("Public token not found in request")

    metadata: Dict[str, str] = router.current_event.json_body.get("metadata", {})
    if not metadata:
        raise BadRequestError("Metadata not found in request")

    institution = metadata.get("institution", {})
    institution_id = institution.get("institution_id")
    if not institution_id:
        raise BadRequestError("Institution ID not found in request")

    if datastore.check_institution(user_id, institution_id):
        raise exceptions.ConflictError("User has already linked to this institution")

    request = ItemPublicTokenExchangeRequest(public_token=public_token)

    client = utils.get_plaid_client()

    try:
        response: ItemPublicTokenExchangeResponse = client.item_public_token_exchange(request)
    except plaid.ApiException:
        logger.exception("Unable to exchange public token")
        raise InternalServerError("Failed to exchange public token")

    item_id: str = response.item_id
    access_token: str = response.access_token

    now = utils.now_iso8601()

    aws_kms_cmp = AwsKmsCryptographicMaterialsProvider(key_id=KEY_ARN)
    actions = AttributeActions(
        default_action=CryptoAction.DO_NOTHING,
        attribute_actions={"access_token": CryptoAction.ENCRYPT_AND_SIGN},
    )
    encrypted_client = EncryptedClient(
        client=dynamodb.meta.client,
        materials_provider=aws_kms_cmp,
        attribute_actions=actions,
        expect_standard_dictionaries=True,
    )

    item = {
        "pk": f"USER#{user_id}#ITEM#{item_id}",
        "sk": "v0",
        "access_token": access_token,
        "institution_id": institution_id,
        "institution_name": institution.get("name"),
        "link_session_id": metadata.get("link_session_id"),
        "created_at": now,
    }

    def mock_write_method(**kwargs):
        return kwargs.get("Item")

    encrypt_item = partial(
        encrypt_put_item,
        encrypted_client._encrypt_item,
        encrypted_client._item_crypto_config,
        mock_write_method,
    )
    encrypted_item = encrypt_item(TableName=TABLE_NAME, Item=item)

    items = [
        {
            "Put": {  # primary item record
                "TableName": TABLE_NAME,
                "Item": encrypted_item,
                "ConditionExpression": "attribute_not_exists(pk) AND attribute_not_exists(sk)",
            }
        },
        {
            "Put": {  # used to prevent duplicate institutions
                "TableName": TABLE_NAME,
                "Item": {
                    "pk": f"USER#{user_id}#INSTITUTIONS",
                    "sk": f"INSTITUTION#{institution_id}",
                    "item_id": item_id,
                },
                "ConditionExpression": "attribute_not_exists(pk) AND attribute_not_exists(sk)",
            }
        },
        {
            "Put": {  # get all of the items across all users or a single user
                "TableName": TABLE_NAME,
                "Item": {
                    "pk": "ITEMS",
                    "sk": f"USER#{user_id}#ITEM#{item_id}",
                    "institution_id": institution_id,
                    "institution_name": institution.get("name"),
                },
                "ConditionExpression": "attribute_not_exists(pk) AND attribute_not_exists(sk)",
            }
        },
        {
            "Put": {  # get the user for an item
                "TableName": TABLE_NAME,
                "Item": {
                    "pk": f"ITEM#{item_id}",
                    "sk": f"USER#{user_id}",
                },
                "ConditionExpression": "attribute_not_exists(pk) AND attribute_not_exists(sk)",
            }
        },
    ]

    metrics.add_metric(name="AddItem", unit=MetricUnit.Count, value=1)

    dynamodb_client: DynamoDBClient = dynamodb.meta.client

    try:
        dynamodb_client.transact_write_items(TransactItems=items)
        logger.debug("Added items to DynamoDB")
        metrics.add_metric(name="AddItemSuccess", unit=MetricUnit.Count, value=1)
    except botocore.exceptions.ClientError:
        logger.exception("Failed to add items to DynamoDB")
        metrics.add_metric(name="AddItemFailed", unit=MetricUnit.Count, value=1)
        raise

    table: Table = dynamodb.Table(TABLE_NAME)

    with table.batch_writer(overwrite_by_pkeys=["pk", "sk"]) as batch:
        for account in metadata.get("accounts", []):
            account_id = account["id"]
            item = {
                "pk": f"USER#{user_id}#ITEM#{item_id}",
                "sk": f"ACCOUNT#{account_id}",
                "account_id": account_id,
                "mask": account["mask"],
                "name": account["name"],
                "subtype": account["subtype"],
                "type": account["type"],
            }
            batch.put_item(Item=item)

    headers = {"Location": f"/v1/items/{item_id}"}

    response = Response(
        status_code=202, content_type=content_types.APPLICATION_JSON, body="", headers=headers
    )

    return response


@router.post("/get_transfer_token")
@tracer.capture_method(capture_response=False)
def create_transfer_token() -> Dict[str, str]:
    logger.info("Getting transfer token")
    user_id: str = utils.authorize_request(router)
    account_id: Union[None, str] = router.current_event.json_body.get("account_id")
    if not account_id:
        raise BadRequestError("Public token not found in request")
    metadata: Dict[str, str] = router.current_event.json_body.get("metadata", {})
    if not metadata:
        raise BadRequestError("Metadata not found in request")
    
    from_institution_id = metadata.get("from_institution_id")
    if not from_institution_id:
        raise BadRequestError("From Institution ID not found in request")
    
    from_account = metadata.get("from_account")
    if not from_account:
        raise BadRequestError("From account ID not found in request")
    
    to_account = metadata.get("to_account")
    if not to_account:
        raise BadRequestError("To account ID not found in request")
    
    to_institution_id = metadata.get("to_institution_id")
    if not to_institution_id:
        raise BadRequestError("To institution ID not found in request")
    
    amount = metadata.get("amount")
    if not amount:
        raise BadRequestError("Amount not found in request")
    
    legal_name = metadata.get("legal_name")
    if not legal_name:
        raise BadRequestError("Legal name not found in request")
    
    amount = metadata.get("amount")
    if not amount:
        raise BadRequestError("Amount not found in request")
    
    description = metadata.get("description")
    if not description:
        raise BadRequestError("Description not found in request")
    
    currency = metadata.get("currency")
    if not currency:
        raise BadRequestError("Currency not found in request")
    
    client_name = metadata.get("client_name")
    if not client_name:
        raise BadRequestError("Currency not found in request")
    logger.info("Verified metadata")

    token_entity = datastore.get_item(user_id=user_id, item_id=account_id)
    access_token: str = token_entity["access_token"]
    logger.info("Retrieved token")
    is_from_rtp_supported = utils.get_is_rtp_capable(from_account, access_token=access_token)
    is_to_rtp_supported = utils.get_is_rtp_capable(from_account, access_token=access_token)
    generated_uuid = uuid.uuid4()

    # Convert the UUID to a string
    uuid_as_string = str(generated_uuid)
    intent_create_object = {
        "mode": TransferIntentCreateMode('PAYMENT'),  # Used for transfer going from the end-user to you
        "user": TransferUserInRequest(legal_name=legal_name),
        "amount": amount,
        "description": description,
        "ach_class": ACHClass("web"),  # Refer to Plaid documentation or contact support for class selection
        "iso_currency_code": currency,
        "network": TransferIntentCreateNetwork("rtp" if (is_from_rtp_supported) else "same-day-ach"),  # Explicitly specifying same-day ACH
        "account_id": from_account,
        "metadata": TransferMetadata({
            "financeGptId": uuid_as_string
        })
    }

    transfer_from_user_to_us = utils.get_transfer_intent_id(TransferIntentCreateRequest(**intent_create_object))
    link_token = create_link_token_for_transfer_ui(transfer_from_user_to_us.id, client_name, access_token)

    dynamodb_client: DynamoDBClient = dynamodb.meta.client
    logger.info("Puttin transfer")

    items = [        
        {
            "Put": {  # get all of the items across all users or a single user
                "TableName": TABLE_NAME,
                "Item": {
                    "pk": "TRANSFER",
                    "sk": f"TRANSFER#{uuid_as_string}",
                    "plaid_type": "intent",
                    "status": "new"
                },
            }
        },
    ]
    logger.info("Writing to ddb")
    try:
        dynamodb_client.transact_write_items(TransactItems=items)
        logger.debug("Added items to DynamoDB")
        metrics.add_metric(name="AddItemSuccess", unit=MetricUnit.Count, value=1)
    except botocore.exceptions.ClientError:
        logger.exception("Failed to add items to DynamoDB")
        metrics.add_metric(name="AddItemFailed", unit=MetricUnit.Count, value=1)
        raise
    logger.info(f"Returning ${link_token}")
    return {"link_token": link_token}

def create_link_token_for_transfer_ui(transfer_intent_id, client_name, access_token):
    client = utils.get_plaid_client()
    user_id: str = utils.authorize_request(router)
    link_token_create_object = LinkTokenCreateRequest(
        webhook=WEBHOOK_URL + "/transfer",
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
        products=[Products("transfer")],
        transfer={
            "intent_id": transfer_intent_id,
        },
        client_name=client_name,
        language= "en",
        country_codes=[CountryCode("CA")],
        access_token=access_token
    )

    # Check if account ID is provided and retrieve the access token

    print(link_token_create_object)

    # Make API call to Plaid to create the link token
    try:
        response = client.link_token_create(link_token_create_object)
        print(f"{response}")
        return response["link_token"]
    except plaid.ApiException as e:
        print(f"An error occurred: {e}")
        return None
