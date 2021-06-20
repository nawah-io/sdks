from packages.hello_nawah.doc import Doc

import pytest


@pytest.mark.setup_test.with_args(
	modules={
		Doc: {},
	},
)
@pytest.mark.asyncio
async def test_doc_read_permissions_admin(call_method_check_permissions, mock_env):
	env = mock_env(privileges={'doc': ['admin']})
	await call_method_check_permissions(
		module='doc',
		method='read',
		env=env,
	)


@pytest.mark.setup_test.with_args(
	modules={
		Doc: {},
	},
)
@pytest.mark.asyncio
async def test_doc_read_permissions_none(call_method_check_permissions):
	await call_method_check_permissions(
		module='doc',
		method='read',
	)


@pytest.mark.setup_test.with_args(
	modules={
		Doc: {},
	},
)
@pytest.mark.asyncio
async def test_doc_read_not_implemented(call_method):
	'''Since read method implementation is provided by Nawah, it can't be unit-tested as a method, and for that it would raise NotImplementedError'''
	
	with pytest.raises(NotImplementedError) as e:
		await call_method(
			module='doc',
			method='read',
		)


@pytest.mark.setup_test.with_args(
	modules={
		Doc: {},
	},
)
@pytest.mark.asyncio
async def test_doc_pre_read_not_implemented(call_handler_pre):
	'''Since pre_read handler implementation is provided by Nawah, it can't be unit-tested as a handler, and for that it would raise NotImplementedError'''
	
	with pytest.raises(NotImplementedError) as e:
		await call_handler_pre(
			module='doc',
			handler='pre_read',
		)


@pytest.mark.setup_test.with_args(
	modules={
		Doc: {},
	},
)
@pytest.mark.asyncio
async def test_doc_on_read(call_handler_on):
	(results, skip_events, env, query, doc, payload) = await call_handler_on(
		module='doc',
		handler='on_read',
		results={
			'count': 3,
			'docs': [
				{'attr_int': 50},
				{'attr_int': 99},
				{'attr_int': 101},
			],
		},
	)

	assert results['count'] == 2
	assert results['docs'][0]['attr_int'] in [50, 99]
