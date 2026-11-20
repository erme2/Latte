import { defineLatteProduct } from './contract'
import { OrganizationAdministration } from './organization/OrganizationAdministration'
import { Connection, Dashboard, Forbidden, NotFound } from './pages'
import { RecordEditor } from './records/RecordEditor'
import { RecordList } from './records/RecordList'
import { createServices, type ProductServices } from './services'

export const product = defineLatteProduct<ProductServices>({
  brand: {
    name: 'My Latte application',
    tagline: 'Replace this product manifest',
  },
  authenticationHosts: ['api.workos.com', '*.authkit.app'],
  defaultPath: '/dashboard',
  createServices,
  routes: [
    {
      id: 'dashboard',
      path: '/dashboard',
      component: Dashboard,
      function: 'dashboard',
    },
    {
      id: 'records',
      path: '/records/:source/:table',
      component: RecordList,
      function: 'records',
    },
    // Listed before the edit route so /new opens the create form.
    {
      id: 'record-new',
      path: '/records/:source/:table/new',
      component: RecordEditor,
      function: 'records',
    },
    {
      id: 'record-edit',
      path: '/records/:source/:table/:rowKey',
      component: RecordEditor,
      function: 'records',
    },
    {
      id: 'connection',
      path: '/connections/:connectionId',
      component: Connection,
      roles: ['admin'],
    },
    {
      id: 'organization-administration',
      path: '/organization',
      component: OrganizationAdministration,
      roles: ['admin'],
      function: 'members',
    },
  ],
  // The menu comes from the install's maps. List here only the always-on
  // entries, such as the maps, menu and settings editors.
  navigation: [],
  // Fixed menu for the Story/Action/Mapper CRUD route: system tables, maps and the
  // Sweegly data tables. The maps-driven menu replaces it later (Latte#71, #72).
  recordMenu: [
    { id: 'maps-tables', label: 'Map tables', source: 'install', table: 'tables' },
    { id: 'maps-fields', label: 'Map fields', source: 'install', table: 'fields' },
    { id: 'maps-field-types', label: 'Field types', source: 'install', table: 'field_types' },
    { id: 'maps-validation-types', label: 'Validation types', source: 'install', table: 'validation_types' },
    { id: 'lists', label: 'Lists', source: 'install', table: 'lists' },
    { id: 'products', label: 'Products', source: 'install', table: 'products' },
  ],
  forbiddenPage: Forbidden,
  notFoundPage: NotFound,
})
