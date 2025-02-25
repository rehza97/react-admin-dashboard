import { Paper, Typography, Stack, IconButton } from '@mui/material';
import { PieChart, Pie, Cell } from 'recharts';
import PropTypes from 'prop-types';

const CardComponent = ({ title, subtitle, icon, data, value, percentageChange }) => {
    return (
        <Paper 
            elevation={2}
            sx={{ 
                height: '100%',
                p: { xs: 2, md: 3 },
                borderRadius: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: 6
                }
            }}
        >
            <Stack spacing={1} sx={{ flexGrow: 1 }}>
                <IconButton 
                    sx={{ 
                        bgcolor: 'primary.light',
                        width: 'fit-content',
                        '&:hover': { bgcolor: 'primary.main' }
                    }}
                >
                    {icon}
                </IconButton>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {title}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {subtitle}
                </Typography>
                <Typography 
                    variant="body2" 
                    sx={{ 
                        color: percentageChange > 0 ? 'success.main' : 'error.main',
                        fontWeight: 'medium'
                    }}
                >
                    {percentageChange > 0 ? `+${percentageChange}%` : `${percentageChange}%`}
                </Typography>
            </Stack>
            <Stack sx={{ 
                width: { xs: '70px', sm: '90px' }, 
                height: { xs: '70px', sm: '90px' },
                ml: 2
            }}>
                <PieChart width={90} height={90}>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={35}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color}
                            />
                        ))}
                    </Pie>
                </PieChart>
            </Stack>
        </Paper>
    );
};

CardComponent.propTypes = {
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string.isRequired,
    icon: PropTypes.node.isRequired,
    data: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            value: PropTypes.number.isRequired,
            color: PropTypes.string.isRequired,
        })
    ).isRequired,
    value: PropTypes.string.isRequired,
    percentageChange: PropTypes.number.isRequired,
};

export default CardComponent; 