from nawah.registry import Registry
from nawah.utils import generate_attr
from nawah.classes import ATTR
from nawah.enums import Event
from nawah.config import Config

from bson import ObjectId

import pytest, datetime, logging

logger = logging.getLogger('nawah')  # Using logger to find where tests are at

state = {}

async def read_doc_as_anon(*, env, expected_count):
	# Before testing assert current user is ANON
	assert str(env['session'].user._id) == 'f00000000000000000000011'

	doc_results = await Registry.module('doc').read(env=env)
	
	assert doc_results.status == 200
	assert doc_results.args.count == expected_count

async def create_doc_as_anon(*, env):
	# Before testing assert current user is ANON
	assert str(env['session'].user._id) == 'f00000000000000000000011'

	doc_results = await Registry.module('doc').create(env=env, doc={
		'attr': None
	})
	
	assert doc_results.status == 403


async def auth_as_admin(*, env):
	session_results = await Registry.module('session').auth(
		skip_events=[Event.PERM, Event.ON],
		env=env,
		doc={
			'email': Config.admin_doc['email'],
			'hash': f'email{Config.admin_doc["email"]}{Config.admin_password}{Config.anon_token}'
		}
	)

	assert session_results.status == 200

async def create_doc_as_admin_invalid(*, env):
	# Before testing assert current user is ADMIN
	assert str(env['session'].user._id) == 'f00000000000000000000010'

	doc_results = await Registry.module('doc').create(env=env, doc={
		'attr': None
	})

	assert doc_results.status == 400
	assert doc_results.args.code == 'HELLO_NAWAH_DOC_MISSING_ATTR'

async def create_doc_as_admin(*, env):
	# Before testing assert current user is ADMIN
	assert str(env['session'].user._id) == 'f00000000000000000000010'

	doc_results = await Registry.module('doc').create(env=env, doc={
		'attr_any': 'This shall pass',
		'attr_bool': 'This shall not pass.. defaults will change this into False', 
		'attr_str': 'This, also, shall pass',
		'attr_locale': generate_attr(attr_type=ATTR.LOCALE()), # Value for Attr Type LOCALE depends on current App Config, let Nawah generate it
		'attr_int': 1,
		'attr_float': 1.1,
		'attr_date': datetime.date.today().isoformat(),
		'attr_time': datetime.datetime.now().time().isoformat(),
		'attr_datetime': datetime.datetime.utcnow().isoformat(),
		'attr_email': 'zed@acme.corp',
		'attr_uri_web': 'https://acme.corp',
		'attr_phone': '+0',
		'attr_file': generate_attr(attr_type=ATTR.FILE()),  # Value for Attr Type FILE is complex, let Nawah generate random value on your behalf.
		'attr_geo': generate_attr(attr_type=ATTR.GEO()),  # Yes, you can generate random values for any Nawah-provided Attrs Types
		'attr_union': 'Well this pass?',
		'attr_list': ['And, what about this?'],
		'attr_kv_dict': {'to_pass':1, 'or_not_to_pass': 0},
		'attr_typed_dict': {
			'child_attr_str': 'You. Shan\'t. Pass.',
			# 'child_attr_int': -1,  # Value here will be set by defaults
		},
	})

	assert doc_results.status == 200
	assert doc_results.args.count == 1

	state['doc'] = doc_results.args.docs[0]

async def read_doc_as_admin(*, env):
	doc_results = await Registry.module('doc').read(env=env)
	
	assert doc_results.status == 200
	assert doc_results.args.count == 1



async def signout(*, env):
	session_results = await Registry.module('session').signout(env=env, query=[{
		'_id': env['session']._id,
	}])

	assert session_results.status == 200

async def update_doc_as_admin_invalid(*, env):
	doc_results = await Registry.module('doc').update(
		env=env,
		query=[{'_id': state['doc']._id}],
		doc={
			'attr_not_existing_in_attrs': 5,
			# Although this attr doesn't exist on Doc module, it is still required by method doc_args, and it will be checked against Attr Type INT and fail because number 5 is out of the allowed ranges
		},
	)

	assert doc_results.status == 400

async def update_doc_as_admin(*, env):
	doc_results = await Registry.module('doc').update(
		env=env,
		query=[{'_id': state['doc']._id}],
		doc={
			'attr_not_existing_in_attrs': 4,
			'attr_bool': True,
		},
	)

	assert doc_results.status == 200
	assert doc_results.args.count == 1


@pytest.mark.asyncio
async def test_workflow(setup_test, env):
	await setup_test()

	logger.info('Running read_doc_as_anon')
	await read_doc_as_anon(env=env(), expected_count=0)
	logger.info('Running create_doc_as_anon')
	await create_doc_as_anon(env=env())
	logger.info('Running auth_as_admin')
	await auth_as_admin(env=env())
	logger.info('Running create_doc_as_admin_invalid')
	await create_doc_as_admin_invalid(env=env())
	logger.info('Running create_doc_as_admin')
	await create_doc_as_admin(env=env())
	logger.info('Running read_doc_as_admin')
	await read_doc_as_admin(env=env())
	logger.info('Running signout')
	await signout(env=env())
	logger.info('Running read_doc_as_anon')
	await read_doc_as_anon(env=env(), expected_count=0) 
	# Doc will not be seeable for ANON user yet because of the Permission Set Query Modifier
	logger.info('Running auth_as_admin')
	await auth_as_admin(env=env())
	logger.info('Running update_doc_as_admin_invalid')
	await update_doc_as_admin_invalid(env=env())
	logger.info('Running update_doc_as_admin')
	await update_doc_as_admin(env=env())
	logger.info('Running signout')
	await signout(env=env())
	logger.info('Running read_doc_as_admin')
	await read_doc_as_admin(env=env())
	logger.info('Running read_doc_as_anon')
	await read_doc_as_anon(env=env(), expected_count=1)
	# But, now after setting 'attr_bool' to True, it is.