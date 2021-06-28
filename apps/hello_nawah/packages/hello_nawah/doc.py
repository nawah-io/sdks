from nawah.base_module import BaseModule
from nawah.classes import ATTR, PERM, EXTN, METHOD
from nawah.enums import Event

import logging

logger = logging.getLogger('nawah')


class Doc(BaseModule):
    '''Doc serves as placeholder Nawah module for new apps'''

    collection = 'docs'  # Nawah modules that deal with data should have collection attribute pointing at the collection the module would use to interact with
    # privileges = ['admin', 'read', 'create', 'update', 'delete'] # By default, any Nawah module defines read, create, update, delete privileges to manage access to the module methods, however, developers can define different sets as needed.
    attrs = {
        # The data structure of the module docs is defined in attrs attribute, a dict of attrs names, types using ATTR controller.
        'user': ATTR.ID(
            desc='Attr \'user\' is Special Attr that is auto-populated of \'_id\' of current user.'
        ),
        'attr_any': ATTR.ANY(desc='Attr Type ANY accepts any value excepts Python NoneType.'),
        'attr_bool': ATTR.BOOL(desc='Attr Type BOOL accepts boolean value.'),
        'attr_str': ATTR.STR(desc='Attr Type STR accespt any string value.'),
        'attr_locale': ATTR.LOCALE(
            desc='Attr Type LOCALE accepts Python dict representing value per localisation supported in the app.'
        ),
        'attr_int': ATTR.INT(desc='Attr Type INT accepts any integer value.'),
        'attr_float': ATTR.FLOAT(desc='Attr Type FLOAT accepts any float value.'),
        'attr_date': ATTR.DATE(
            desc='Attr Type DATE accepts ISO-format UTC-based date as string value.'
        ),
        'attr_time': ATTR.TIME(
            desc='Attr Type TIME accepts ISO-format UTC-based date as string value.'
        ),
        'attr_datetime': ATTR.DATETIME(
            desc='Attr Type DATETIME accepts ISO-format UTC-based date as string value.'
        ),
        'attr_email': ATTR.EMAIL(
            desc='Attr Type EMAIL accepts any string value that qualifies as email address.'
        ),
        'attr_uri_web': ATTR.URI_WEB(
            desc='Attr Type URI_WEB accepts any string value that qualifies as web URI.'
        ),
        'attr_phone': ATTR.PHONE(
            desc='Attr Type PHONE accepts any string value that qualifies as phone number; a \'+\' followed with a number.'
        ),
        'attr_file': ATTR.FILE(desc='Attr Type FILE accepts Nawah-specific file-format.'),
        'attr_geo': ATTR.GEO(desc='Attr Type GEO accepts GeoJSON-format value.'),
        'attr_union': ATTR.UNION(
            desc='Attr Type UNION accepts \'union\' Attr Type Arg that specifies two or more types that can be accepted.',
            union=[ATTR.STR(), ATTR.INT()],
        ),
        'attr_list': ATTR.LIST(
            desc='Attr Type LIST accepts Python list of items of any type specified in \'list\' Attr Type Arg.',
            list=[ATTR.STR()],
        ),
        'attr_kv_dict': ATTR.KV_DICT(
            desc='Attr Type KV_DICT accepts Python dict with keys of type specified as \'key\' Attr Type Arg, and values of type specified as \'val\' Attr Type Arg.',
            key=ATTR.STR(),
            val=ATTR.INT(),
        ),
        'attr_typed_dict': ATTR.TYPED_DICT(
            desc='Attr Type TYPED_DICT accepts Python dict of specified key-value pairs as \'dict\' Attr Type Arg.',
            dict={
                'child_attr_str': ATTR.STR(),
                'child_attr_int': ATTR.INT(),
            },
        ),
        'create_time': ATTR.DATETIME(desc='Attr \'create_time\' is Special Attr that is auto-populated of datetime of document creation.'),
    }
    defaults = {
        # By design, Nawah would only create a doc if all attrs values are provided and are passing the type check.
        # So, to allow developers to configure this behaviour, Nawah module defaults attribute can be used to define attrs names with default values.
        'attr_any': None, # Attr Type ANY accepts any any non-NoneType, however, 'None' can be allowed by setting it in defaults. This is applicable to all Attrs Types.
        'attr_bool': False, # If no value is provided for 'attr_bool' attr, it would be auto-set as 'False'
        'attr_list:0': 'Nested List Value', # Default values can be set to nested attrs using colon-notation for any Attr Type that accepts a Python list.
        'attr_typed_dict.child_attr_int': -1, # Default values can be set to nested attrs using dot-notation for any Attr Type that accepts a Python dict.
        # Since Nawah allows complex structures of nested lists and dicts, default values can be set to deep nested attrs by mixing dot-notation, and colon-notation formats.
    }
    unique_attrs = [
        # In events where developers tend to have a module accept docs, but to only have single doc per value for an attr, unique_attrs attribute can be used.
        'attr_str', # By specifying an attr, every time a doc is being created or updated, the value of the attr would be checked to assert only one doc is holding the value at any given time.
        ('attr_email', 'attr_uri_web'), # If complex structure of multiple attrs have to be checked altogether, a tuple can be used to group the attrs.
    ]
    # extns = {}  # Learn more about Extending Attrs in Nawah Docs
    methods = {
        # Methods are the module windows to the world, where developer can get to interact with the module, either via the API, or via internal calls.
        # Nawah provides complete set of methods for the basic functionalities so developers can focus on engineering the app, rather than writing repetitive logic.
        # Methods available for use out of the box:
        # - read: Basic read functinoality.
        # - create: Basic create functinoality.
        # - update: Basic update functionality.
        # - delete: Basic delete functionality.
        # - retrieve_file: GET method to access files in docs.
        # - create_file: Method to upload additional file to doc
        # - delete_file: Method to delete file from doc
        # The previous methods implementation are available for use as long as developer defines them in module methods.
        # If developers need to do some checks prior to functionality sequence, or process the data afterwards, the handlers pre and on can be used. For instance, a pre_create handler can be implemented in the module to do some extra checks, or modify the data before it gets created in the database.
        # Additional methods can be defined and implemented in the module.
        'read': METHOD(
            # A method definition uses METHOD controller
            permissions=[
                # METHOD controller requires permissions attribute, which is list of Permissions Sets.
                # A Permission Set is how Nawah knows whether to allow the call to the method or deny it.
                # Using PERM controller, developers define privilege attribute which correspond to privilege of current module, or cross-module privilege (dot-notated, e.g. module_foo.privilege_bar)
                PERM(privilege='admin'),
                # By specifying a Permission Set with privilege admin, a user with privilege doc.admin can access this method.
                PERM(privilege='*', query_mod={'attr_bool': True, '$limit': 10}),
                # By specifying privilege as *, any user can access this method, however the query would by modified using Query Modifier Set[s].
                # In this Permission Set, irregardless of whether the call query included 'attr_boot', '$limit' or not, attrs provided in Query Modifier Set would be appended to the query to restrict access for non-admin users.
            ]
        ),
        'create': METHOD(permissions=[
            PERM(privilege='admin'),
            PERM(privilege='create', doc_mod={'attr_bool': False}),
            # Using Doc Modifier Set, if the user is not having admin privilege, but create, call doc would be modified to set 'attr_bool' to False, whether it was provided in call doc, or not.
        ]),
        'update': METHOD(
            permissions=[PERM(privilege='update')],
            doc_args={'attr_not_existing_in_attrs': ATTR.INT(ranges=[[1, 5], [11, 15]])},
            # METHOD controller accepts doc_args attribute which defines set of attrs, whether present in module attrs or not, to be provided as part of call doc, with specific type.
            # In this method definition a call to update method would be denied unless call doc has 'attr_not_existing_in_attrs' with its value of type INT of ranges [1, 5] (inclusive), or [11, 15) (exclusive).
        ),
        'delete': METHOD(
            permissions=[PERM(privilege='delete')],
            query_args={'_id': ATTR.DYNAMIC_ATTR(types=['TYPED_DICT'])},
            # Likewise with doc_args, METHOD controller accepts query_args to specify attrs required as part of call query.
            # In this method definition, a call to delete method require attr '_id' to be present in call query of type ID. By setting query_args like this, the call would always be expected to run against one doc only.
        ),
        'retrieve_file': METHOD(
            permissions=[PERM(privilege='*')],
            get_method=True,
        ),
        # Defining retrieve_file method requires setting get_method of METHOD controller to True, or else it would be ignored for basic configuration to access the method over GET request.

        # In addition to Special Privilege * (asterisk),  Special Privilege __sys exist to allow developers to define methods that are only allowed to be accessed internally by passing permissions check (using Event.PERM in call skip_events).
        'magic': METHOD(
            permissions=[PERM(privilege='read')],
        )
    }

    async def on_read(self, results, skip_events, env, query, doc, payload):
        '''Handler on_read should return (results, skip_events, env, query, doc, payload) unless it is raising Exception'''

        # For example use, results would be modified:
        results['docs'] = [doc for doc in results['docs'] if doc.attr_int < 100]
        results['count'] = len(results['docs'])

        return (results, skip_events, env, query, doc, payload)

    async def pre_create(self, skip_events, env, query, doc, payload):
        '''Handler pre_create should return (skip_events, env, query, doc, payload) unless it is raising Exception'''

        # For example use, this condition is added, whereas developers would be using INT.ranges otherwise:
        if 'attr_int' in doc.keys() and doc['attr_int'] > 99:
            raise self.exception(
                status=400,
                msg='Invalid value for \'attr_int\'.',
                args={'code': 'INVALID_ATTR'},
            )

        return (skip_events, env, query, doc, payload)
    

    async def magic(self, skip_events=[], env={}, query=[], doc={}):
        doc_results = await self.read(skip_events=[Event.PERM], env=env, query=query)

        return self.status(
            status=200,
            msg='Nawah is pure magic!',
            args=doc_results.args
        )
