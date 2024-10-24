'use client'
import './data-tables-css.css'
import './satoshi.css'
import { useState, useEffect } from 'react'
import Loader from './components/common/Loader'

import Sidebar from './components/Sidebar/Sidebar'
import Header from './components/Header'
import ChatBar from './components/Chatbar/Chatbar'
import { Provider } from 'react-redux'
import { store } from './store'
import { useParams } from 'react-router-dom'

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [chatbarOpen, setChatbarOpen] = useState(false)
    const { id } = useParams()
    const [loading, setLoading] = useState<boolean>(true)

    useEffect(() => {
        setTimeout(() => setLoading(false), 1000)
    }, [])
    console.log(chatbarOpen)
    return (
        <Provider store={store}>
            <div className="dark:bg-black dark:text-bodydark">
                {loading ? (
                    <Loader />
                ) : (
                    <div className="flex h-screen overflow-hidden">
                        {/* <!-- ===== Sidebar Start ===== --> */}
                        <Sidebar />
                        {/* <!-- ===== Sidebar End ===== --> */}

                        {/* <!-- ===== Content Area Start ===== --> */}
                        <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden hide-scrollbar">
                            {/* <!-- ===== Header Start ===== --> */}
                            <Header
                                sidebarOpen={sidebarOpen}
                                setSidebarOpen={setSidebarOpen}
                                setChatbarOpen={setChatbarOpen}
                                chatbarOpen={chatbarOpen}
                            />
                            {/* <!-- ===== Header End ===== --> */}

                            {/* <!-- ===== Main Content Start ===== --> */}
                            <main>
                                <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">{children}</div>
                            </main>
                            {/* <!-- ===== Main Content End ===== --> */}
                        </div>
                        <ChatBar id={id || ''} isSidebarOpen={chatbarOpen} setIsSidebarOpen={setChatbarOpen} />

                        {/* <!-- ===== Content Area End ===== --> */}
                    </div>
                )}
            </div>
        </Provider>
    )
}
