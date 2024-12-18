import React, { useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CustomTextBox } from '../Custom/CustomTextBox'
import { Button, Heading } from '@aws-amplify/ui-react'
import { useAppDispatch, useAppSelector } from '../../../hooks'
import Markdown from '../../../components/native/Markdown'
import HighchartsReact from 'highcharts-react-official'
import * as Highcharts from 'highcharts'
import HighchartsStock from 'highcharts/highstock'
import Indicators from 'highcharts/indicators/indicators-all.js'
import DragPanes from 'highcharts/modules/drag-panes.js'
import AnnotationsAdvanced from 'highcharts/modules/annotations-advanced.js'
import PriceIndicator from 'highcharts/modules/price-indicator.js'
import FullScreen from 'highcharts/modules/full-screen.js'
import StockTools from 'highcharts/modules/stock-tools.js'
import Loader from '../../../components/common/Loader'
import exporting from 'highcharts/modules/exporting'
import { getInvestmentAnalysis, getInvestmentNews } from '../../../../src/features/investments'
import { generateClient } from 'aws-amplify/api'
import { Security } from '../../../../src/API'
import { getIdFromSecurity } from '../../../../src/libs/utlis'

interface Props {
    activeStock?: Security // Type this based on your actual activeStock structure
    onClose: () => void // Function to close the modal
}

Indicators(HighchartsStock)
DragPanes(HighchartsStock)
AnnotationsAdvanced(HighchartsStock)
PriceIndicator(HighchartsStock)
FullScreen(HighchartsStock)
StockTools(HighchartsStock)
exporting(HighchartsStock)

const StockOverlayComponent: React.FC<Props> = ({ activeStock, onClose }) => {
    const chart = useRef()
    const stockKnoweldge = useAppSelector((state) => state.investments.investmentKnoweldge)
    const toggleFullScreen = () => {
        ;(chart.current as any).chart.fullscreen.toggle()
    }
    const dispatch = useAppDispatch()
    const client = generateClient()
    useEffect(() => {
        const activeKnoweldge = stockKnoweldge[getIdFromSecurity(activeStock)]
        if (!activeKnoweldge?.news && !activeKnoweldge?.loadingNews) {
            dispatch(
                getInvestmentNews({
                    client: client,
                    security: activeStock,
                })
            )
            dispatch(
                getInvestmentAnalysis({
                    client: client,
                    security: activeStock,
                })
            )
        }
    }, [])
    console.log(
        stockKnoweldge[getIdFromSecurity(activeStock)]?.priceData,
        stockKnoweldge[getIdFromSecurity(activeStock)]?.loadingAnalysis
    )
    return (
        <Dialog.Root open={!!activeStock} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Trigger asChild>
                {/* Optional: Add a button here if you want to trigger the modal manually */}
                <button className="hidden">Open Overlay</button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50" style={{ zIndex: 998 }} />
                <Dialog.Content className="z-999 fixed max-h-[75vh] overflow-y-auto top-1/2 left-1/4 transform -translate-x-1/4 -translate-y-1/2 max-w-7xl w-full bg-white dark:bg-boxdark p-6 rounded-lg shadow-lg flex space-x-4 z-10001">
                    {/* News Section */}
                    <div className="w-1/2 p-4 border-r dark:border-strokedark">
                        <Heading level={4} className="text-lg font-semibold mb-2">
                            <CustomTextBox>News</CustomTextBox>
                        </Heading>
                        {/* Replace with your actual news content */}
                        {stockKnoweldge[getIdFromSecurity(activeStock)]?.loadingNews && <Loader />}
                        <div className="text-gray-700 dark:text-gray-300">
                            <CustomTextBox>
                                <Markdown>{stockKnoweldge[getIdFromSecurity(activeStock)]?.news}</Markdown>
                            </CustomTextBox>
                        </div>
                    </div>
                    {stockKnoweldge[getIdFromSecurity(activeStock)]?.priceData?.length ? (
                        <div className="w-1/2 p-4 border-r dark:border-strokedark">
                            <Heading level={4} className="text-lg font-semibold mb-2">
                                <CustomTextBox>Pricing</CustomTextBox>
                                <HighchartsReact
                                    ref={chart as any}
                                    highcharts={HighchartsStock}
                                    options={
                                        {
                                            xAxis: {
                                                categories: stockKnoweldge[
                                                    getIdFromSecurity(activeStock)
                                                ]?.priceData.map((_, index) => {
                                                    const startDate = new Date()
                                                    startDate.setDate(startDate.getDate() - 14 + index)
                                                    return startDate.toDateString()
                                                }),
                                            },
                                            series: [
                                                {
                                                    data: stockKnoweldge[getIdFromSecurity(activeStock)]?.priceData,
                                                    name: 'Price',
                                                },
                                            ],
                                            stockTools: {
                                                gui: {
                                                    enabled: true,
                                                },
                                            },
                                            title: {
                                                text: '2 weeks price chart',
                                            },
                                        } as Highcharts.Options
                                    }
                                />
                                <Button onClick={toggleFullScreen}>
                                    <CustomTextBox>Show full screen</CustomTextBox>
                                </Button>{' '}
                            </Heading>
                        </div>
                    ) : (
                        <></>
                    )}
                    {/* Analysis Section */}
                    <div className="w-1/2 p-4">
                        <Heading level={4} className="text-lg font-semibold mb-2">
                            <CustomTextBox>Analysis</CustomTextBox>
                        </Heading>
                        {/* Replace with your actual analysis content */}
                        <div className="text-gray-700 dark:text-gray-300">
                            {stockKnoweldge[getIdFromSecurity(activeStock)]?.loadingAnalysis && <Loader />}
                            <CustomTextBox>
                                <Markdown>{stockKnoweldge[getIdFromSecurity(activeStock)]?.analysis}</Markdown>
                            </CustomTextBox>
                        </div>
                    </div>

                    {/* Close Button */}
                    <Dialog.Close asChild>
                        <button className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white">
                            ×
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

export default StockOverlayComponent
