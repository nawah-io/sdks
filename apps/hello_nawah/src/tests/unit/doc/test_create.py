from packages.hello_nawah.doc import Doc

from nawah.classes import InvalidPermissionsExcpetion

import pytest


@pytest.mark.setup_test.with_args(
	modules={
		Doc: {},
	},
)
@pytest.mark.asyncio
async def test_doc_create_permissions_create(call_method_check_permissions, mock_env):
	env = mock_env(privileges={'doc': ['create']})
	await call_method_check_permissions(
		module='doc',
		method='create',
		env=env,
	)


@pytest.mark.setup_test.with_args(
	modules={
		Doc: {},
	},
)
@pytest.mark.asyncio
async def test_doc_create_permissions_none(call_method_check_permissions):
	with pytest.raises(InvalidPermissionsExcpetion):
		await call_method_check_permissions(
			module='doc',
			method='create',
		)