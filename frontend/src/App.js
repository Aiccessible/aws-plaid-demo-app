import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Authenticator } from "@aws-amplify/ui-react";
import Protected from './pages/Protected';
import Login from './pages/Login';
import Institution from './pages/Institution';
import Layout from './components/Layout';
import RequireAuth from './RequireAuth';

import './App.css';
import Transactions from './components/Transactions';
import Investments from './components/Investments';
import Accounts from './components/Accounts';
import RootLayout from './RootLayout';
import AnalyzeRecommendation from './components/Analysis/AnalyzeRecommendation'

function App() {
  return (
      <Authenticator.Provider>
          <BrowserRouter>
              <Routes>
                  <Route path="/" element={<Layout />}>
                      <Route
                          index
                          element={
                              <RequireAuth>
                                  <RootLayout>
                                      <Protected />
                                  </RootLayout>
                              </RequireAuth>
                          }
                      />
                      <Route
                          path="/institution/:id/transactions"
                          element={
                              <RequireAuth>
                                  <RootLayout>
                                      <Transactions />
                                  </RootLayout>
                              </RequireAuth>
                          }
                      />
                      <Route
                          path="/institution/:id/investments"
                          element={
                              <RequireAuth>
                                  <RootLayout>
                                      <Investments />
                                  </RootLayout>
                              </RequireAuth>
                          }
                      />
                      <Route
                          path="/institution/:id/accounts"
                          element={
                              <RequireAuth>
                                  <RootLayout>
                                      <Accounts updateAccounts={() => {}} />
                                  </RootLayout>
                              </RequireAuth>
                          }
                      />
                      <Route
                          path="/institution/:id"
                          element={
                              <RequireAuth>
                                  <RootLayout>
                                      <Institution />
                                  </RootLayout>
                              </RequireAuth>
                          }
                      />
                      <Route
                          path={`/institution/:id/analyze/recommendation/:name`}
                          element={
                              <RequireAuth>
                                  <RootLayout>
                                      <AnalyzeRecommendation />
                                  </RootLayout>
                              </RequireAuth>
                          }
                      />
                      <Route path="/login" element={<Login />} />
                  </Route>
              </Routes>
          </BrowserRouter>
      </Authenticator.Provider>
  )
}

export default App;
